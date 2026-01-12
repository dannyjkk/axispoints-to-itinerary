/**
 * Express handlers for Seats.aero API endpoints (local dev).
 * These mirror the Vercel serverless functions in /api/seats/*.
 */

import dotenv from 'dotenv';
dotenv.config();

const SEATS_API_KEY = process.env.SEATS_API_KEY || '';

/**
 * Helper: add days to a date string (YYYY-MM-DD)
 */
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Helper: compute nights between two date strings
 */
function nightsBetween(startStr, endStr) {
  const a = new Date(startStr + 'T00:00:00Z');
  const b = new Date(endStr + 'T00:00:00Z');
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * Fetch Seats Cached Search
 */
async function fetchCachedSearch(origin, destination, startDate, endDate) {
  const params = new URLSearchParams({
    origin_airport: origin,
    destination_airport: destination,
    start_date: startDate,
    end_date: endDate,
    take: '100',
    include_trips: 'false',
    only_direct_flights: 'false',
    include_filtered: 'false',
    sources: 'united,aeroplan,singapore,flyingblue',
  });

  const url = `https://seats.aero/partnerapi/search?${params.toString()}`;
  const resp = await fetch(url, {
    headers: {
      accept: 'application/json',
      'Partner-Authorization': `${SEATS_API_KEY}`,
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    const err = new Error('Seats Cached Search failed');
    err.status = resp.status;
    err.detail = text;
    throw err;
  }

  const data = await resp.json();
  return Array.isArray(data?.data) ? data.data : [];
}

/**
 * Fetch Seats Get Trips for a given availability ID
 */
async function fetchTrips(availabilityId) {
  const url = `https://seats.aero/partnerapi/trips/${availabilityId}?include_filtered=false`;
  const resp = await fetch(url, {
    headers: {
      accept: 'application/json',
      'Partner-Authorization': `${SEATS_API_KEY}`,
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    const err = new Error('Seats Get Trips failed');
    err.status = resp.status;
    err.detail = text;
    throw err;
  }

  const data = await resp.json();
  return Array.isArray(data?.data) ? data.data : [];
}

/**
 * Check cabin availability in a Cached Search result.
 */
function getCabinAvailability(item) {
  return {
    economy: item?.YAvailable === true || item?.YAvailableRaw === true,
    business: item?.JAvailable === true || item?.JAvailableRaw === true,
  };
}

/**
 * Pick the best trip option for a given cabin.
 */
function pickBestTrip(trips, cabin) {
  const cabinLower = cabin.toLowerCase();
  const matching = trips.filter((t) => {
    const tripCabin = (t?.Cabin || '').toLowerCase();
    return tripCabin === cabinLower;
  });

  if (matching.length === 0) return null;

  matching.sort((a, b) => {
    const stopsA = typeof a.Stops === 'number' ? a.Stops : 999;
    const stopsB = typeof b.Stops === 'number' ? b.Stops : 999;
    if (stopsA !== stopsB) return stopsA - stopsB;
    const durA = typeof a.TotalDuration === 'number' ? a.TotalDuration : 99999;
    const durB = typeof b.TotalDuration === 'number' ? b.TotalDuration : 99999;
    return durA - durB;
  });

  return matching[0];
}

/**
 * Extract minimal UI fields from a trip object
 */
function extractTripSummary(trip) {
  if (!trip) return null;
  return {
    origin: trip.OriginAirport || '',
    destination: trip.DestinationAirport || '',
    departsAt: trip.DepartsAt || '',
    arrivesAt: trip.ArrivesAt || '',
    stops: typeof trip.Stops === 'number' ? trip.Stops : null,
    carriers: trip.Carriers || '',
    flightNumbers: trip.FlightNumbers || '',
    aircraft: Array.isArray(trip.Aircraft) ? trip.Aircraft[0] || '' : '',
    cabin: trip.Cabin || '',
    remainingSeats: typeof trip.RemainingSeats === 'number' ? trip.RemainingSeats : null,
  };
}

/**
 * GET /api/seats/date-pairs
 */
export async function handleDatePairs(req, res) {
  if (!SEATS_API_KEY) {
    return res.status(500).json({ error: 'SEATS_API_KEY missing on server' });
  }

  const {
    origin_airport,
    destination_airport,
    start_date,
    end_date,
    min_nights = '3',
    max_nights = '10',
    cabin_pref = 'economy',
  } = req.query;

  if (!origin_airport || !destination_airport || !start_date || !end_date) {
    return res.status(400).json({
      error: 'Missing required query params',
      detail: 'Required: origin_airport, destination_airport, start_date, end_date',
    });
  }

  const minN = Math.max(1, parseInt(min_nights, 10) || 3);
  const maxN = Math.max(minN, parseInt(max_nights, 10) || 10);
  const preferEconomy = cabin_pref.toLowerCase() !== 'business';

  try {
    const [outboundResults, returnResults] = await Promise.all([
      fetchCachedSearch(origin_airport, destination_airport, start_date, end_date),
      fetchCachedSearch(destination_airport, origin_airport, start_date, end_date),
    ]);

    if (outboundResults.length === 0) {
      return res.status(200).json({
        cards: [],
        message: `No outbound availability found for ${origin_airport} → ${destination_airport} in this date range`,
      });
    }

    if (returnResults.length === 0) {
      return res.status(200).json({
        cards: [],
        message: `No return availability found for ${destination_airport} → ${origin_airport} in this date range`,
      });
    }

    // Build return map by date
    const returnByDate = new Map();
    for (const r of returnResults) {
      const dateStr = r?.Date;
      if (!dateStr) continue;
      if (!returnByDate.has(dateStr)) {
        returnByDate.set(dateStr, { economy: [], business: [] });
      }
      const avail = getCabinAvailability(r);
      if (avail.economy) returnByDate.get(dateStr).economy.push(r);
      if (avail.business) returnByDate.get(dateStr).business.push(r);
    }

    // Sort outbound by date
    const sortedOutbound = [...outboundResults].sort((a, b) => {
      const dateA = a?.Date || '';
      const dateB = b?.Date || '';
      return dateA.localeCompare(dateB);
    });

    // Find up to 3 valid pairs
    const pairs = [];
    const usedOutboundDates = new Set();

    for (const outItem of sortedOutbound) {
      if (pairs.length >= 3) break;

      const outDate = outItem?.Date;
      if (!outDate || usedOutboundDates.has(outDate)) continue;

      const outAvail = getCabinAvailability(outItem);
      let chosenCabin = null;
      if (preferEconomy) {
        if (outAvail.economy) chosenCabin = 'economy';
        else if (outAvail.business) chosenCabin = 'business';
      } else {
        if (outAvail.business) chosenCabin = 'business';
        else if (outAvail.economy) chosenCabin = 'economy';
      }
      if (!chosenCabin) continue;

      const earliestReturn = addDays(outDate, minN);
      const latestReturn = addDays(outDate, maxN);

      let matchedReturn = null;
      let matchedReturnDate = null;

      const validReturnDates = [];
      for (const [rDateStr, rItems] of returnByDate) {
        if (rDateStr < earliestReturn || rDateStr > latestReturn) continue;
        const cabinItems = chosenCabin === 'economy' ? rItems.economy : rItems.business;
        if (cabinItems.length > 0) {
          validReturnDates.push({ date: rDateStr, items: cabinItems });
        }
      }

      validReturnDates.sort((a, b) => a.date.localeCompare(b.date));

      if (validReturnDates.length > 0) {
        matchedReturnDate = validReturnDates[0].date;
        matchedReturn = validReturnDates[0].items[0];
      }

      // Fallback to other cabin
      if (!matchedReturn) {
        const fallbackCabin = chosenCabin === 'economy' ? 'business' : 'economy';
        const fallbackDates = [];
        for (const [rDateStr, rItems] of returnByDate) {
          if (rDateStr < earliestReturn || rDateStr > latestReturn) continue;
          const cabinItems = fallbackCabin === 'economy' ? rItems.economy : rItems.business;
          if (cabinItems.length > 0) {
            fallbackDates.push({ date: rDateStr, items: cabinItems, cabin: fallbackCabin });
          }
        }
        fallbackDates.sort((a, b) => a.date.localeCompare(b.date));
        if (fallbackDates.length > 0) {
          matchedReturnDate = fallbackDates[0].date;
          matchedReturn = fallbackDates[0].items[0];
        }
      }

      if (!matchedReturn || !matchedReturnDate) continue;

      usedOutboundDates.add(outDate);
      pairs.push({
        outboundItem: outItem,
        returnItem: matchedReturn,
        departDate: outDate,
        returnDate: matchedReturnDate,
        chosenCabin,
      });
    }

    if (pairs.length === 0) {
      return res.status(200).json({
        cards: [],
        message: `No date pairs found for ${minN}–${maxN} nights in this month`,
      });
    }

    // Fetch trips and build cards
    const cards = await Promise.all(
      pairs.map(async (pair) => {
        const [outTrips, retTrips] = await Promise.all([
          fetchTrips(pair.outboundItem.ID),
          fetchTrips(pair.returnItem.ID),
        ]);

        const bestOutbound = pickBestTrip(outTrips, pair.chosenCabin);
        const bestReturn = pickBestTrip(retTrips, pair.chosenCabin);

        const nights = nightsBetween(pair.departDate, pair.returnDate);

        return {
          departDate: pair.departDate,
          returnDate: pair.returnDate,
          nights,
          cabin: pair.chosenCabin,
          outboundTripSummary: extractTripSummary(bestOutbound),
          returnTripSummary: extractTripSummary(bestReturn),
        };
      })
    );

    return res.status(200).json({ cards });
  } catch (err) {
    console.error('[date-pairs error]', err);
    const status = err?.status || 500;
    return res.status(status).json({
      error: err?.message || 'Internal error',
      detail: err?.detail || undefined,
    });
  }
}

/**
 * GET /api/seats/trips
 */
export async function handleTrips(req, res) {
  if (!SEATS_API_KEY) {
    return res.status(500).json({ error: 'SEATS_API_KEY missing on server' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({
      error: 'Missing required query param: id',
      detail: 'Provide the availabilityId as ?id=...',
    });
  }

  try {
    const url = `https://seats.aero/partnerapi/trips/${id}?include_filtered=false`;
    const resp = await fetch(url, {
      headers: {
        accept: 'application/json',
        'Partner-Authorization': `${SEATS_API_KEY}`,
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({
        error: 'Seats Get Trips failed',
        detail: text,
      });
    }

    const data = await resp.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('[trips proxy error]', err);
    return res.status(500).json({
      error: err?.message || 'Internal error',
    });
  }
}

