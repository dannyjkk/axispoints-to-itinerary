/**
 * GET /api/seats/date-pairs
 *
 * Generates up to 3 date-pair cards (outbound + return) using Seats.aero Cached Search + Get Trips.
 *
 * Query params:
 *   origin_airport      - e.g. "BLR"
 *   destination_airport - e.g. "BKK"
 *   start_date          - YYYY-MM-DD (month start)
 *   end_date            - YYYY-MM-DD (month end)
 *   min_nights          - default 3
 *   max_nights          - default 10
 *   cabin_pref          - default "economy" (economy|business)
 */

const SEATS_API_KEY = process.env.SEATS_API_KEY || '';

/**
 * Map source codes to human-readable program names
 */
const PROGRAM_NAMES = {
  united: 'United MileagePlus',
  aeroplan: 'Air Canada Aeroplan',
  flyingblue: 'Air France–KLM Flying Blue',
  singapore: 'Singapore Airlines KrisFlyer',
};

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
 * Returns { economy: boolean, business: boolean }
 */
function getCabinAvailability(item) {
  return {
    economy: item?.YAvailable === true || item?.YAvailableRaw === true,
    business: item?.JAvailable === true || item?.JAvailableRaw === true,
  };
}

/**
 * Pick the best trip option for a given cabin.
 * Ranks by: fewest Stops, then shortest TotalDuration.
 */
function pickBestTrip(trips, cabin) {
  const cabinLower = cabin.toLowerCase();
  const matching = trips.filter((t) => {
    const tripCabin = (t?.Cabin || '').toLowerCase();
    return tripCabin === cabinLower;
  });

  if (matching.length === 0) return null;

  // Sort by Stops asc, then TotalDuration asc
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
  const sourceCode = trip.Source || '';
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
    source: sourceCode,
    programName: PROGRAM_NAMES[sourceCode] || sourceCode,
    mileageCost: typeof trip.MileageCost === 'number' ? trip.MileageCost : null,
  };
}

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check API key
  if (!SEATS_API_KEY) {
    return res.status(500).json({ error: 'SEATS_API_KEY missing on server' });
  }

  // Parse query params
  const {
    origin_airport,
    destination_airport,
    start_date,
    end_date,
    min_nights = '3',
    max_nights = '10',
    cabin_pref = 'economy',
  } = req.query;

  // Validate required params
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
    // 1) Fetch outbound and return cached searches in parallel
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

    // 2) Build a map of return availabilities by date
    // Map<dateStr, { economy: item[], business: item[] }>
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

    // 3) Sort outbound by date ascending
    const sortedOutbound = [...outboundResults].sort((a, b) => {
      const dateA = a?.Date || '';
      const dateB = b?.Date || '';
      return dateA.localeCompare(dateB);
    });

    // 4) Find ALL valid pairs, grouped by duration (nights)
    const pairsByDuration = new Map(); // Map<nights, pair[]>

    for (const outItem of sortedOutbound) {
      const outDate = outItem?.Date;
      if (!outDate) continue;

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

      // Find all valid return dates for this outbound
      for (const [rDateStr, rItems] of returnByDate) {
        if (rDateStr < earliestReturn || rDateStr > latestReturn) continue;
        
        let matchedReturn = null;
        let matchedCabin = chosenCabin;
        
        // Try preferred cabin first
        const cabinItems = chosenCabin === 'economy' ? rItems.economy : rItems.business;
        if (cabinItems.length > 0) {
          matchedReturn = cabinItems[0];
        }
        
        // Fallback to other cabin
        if (!matchedReturn) {
          const fallbackCabin = chosenCabin === 'economy' ? 'business' : 'economy';
          const fallbackItems = fallbackCabin === 'economy' ? rItems.economy : rItems.business;
          if (fallbackItems.length > 0) {
            matchedReturn = fallbackItems[0];
            matchedCabin = fallbackCabin;
          }
        }
        
        if (!matchedReturn) continue;
        
        const nights = nightsBetween(outDate, rDateStr);
        if (nights < minN || nights > maxN) continue;
        
        if (!pairsByDuration.has(nights)) {
          pairsByDuration.set(nights, []);
        }
        
        pairsByDuration.get(nights).push({
          outboundItem: outItem,
          returnItem: matchedReturn,
          departDate: outDate,
          returnDate: rDateStr,
          chosenCabin: matchedCabin,
          nights,
        });
      }
    }

    // Get available durations and spread them to pick 5 unique ones
    const availableDurations = [...pairsByDuration.keys()].sort((a, b) => a - b);
    
    // Pick up to 5 durations with good spread
    let selectedDurations = [];
    if (availableDurations.length <= 5) {
      selectedDurations = availableDurations;
    } else {
      // Spread evenly across the range
      const step = (availableDurations.length - 1) / 4; // 5 picks = 4 gaps
      for (let i = 0; i < 5; i++) {
        const idx = Math.round(i * step);
        selectedDurations.push(availableDurations[idx]);
      }
      // Remove duplicates and ensure uniqueness
      selectedDurations = [...new Set(selectedDurations)];
    }

    // Pick one pair per selected duration (earliest outbound date)
    const pairs = [];
    for (const nights of selectedDurations) {
      const candidates = pairsByDuration.get(nights) || [];
      if (candidates.length > 0) {
        // Sort by outbound date and pick the first
        candidates.sort((a, b) => a.departDate.localeCompare(b.departDate));
        pairs.push(candidates[0]);
      }
    }

    // Sort final pairs by nights ascending
    pairs.sort((a, b) => a.nights - b.nights);

    if (pairs.length === 0) {
      return res.status(200).json({
        cards: [],
        message: `No date pairs found for ${minN}–${maxN} nights in this month`,
      });
    }

    // 5) For each pair, fetch Get Trips and extract best option
    const cards = await Promise.all(
      pairs.map(async (pair) => {
        const [outTrips, retTrips] = await Promise.all([
          fetchTrips(pair.outboundItem.ID),
          fetchTrips(pair.returnItem.ID),
        ]);

        const bestOutbound = pickBestTrip(outTrips, pair.chosenCabin);
        const bestReturn = pickBestTrip(retTrips, pair.chosenCabin);

        const nights = nightsBetween(pair.departDate, pair.returnDate);

        const outboundSummary = extractTripSummary(bestOutbound);
        const returnSummary = extractTripSummary(bestReturn);

        // Calculate total points (sum of both legs)
        const outboundPoints = outboundSummary?.mileageCost || 0;
        const returnPoints = returnSummary?.mileageCost || 0;
        const totalPoints = outboundPoints + returnPoints;

        return {
          departDate: pair.departDate,
          returnDate: pair.returnDate,
          nights,
          cabin: pair.chosenCabin,
          outboundTripSummary: outboundSummary,
          returnTripSummary: returnSummary,
          totalPoints,
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

