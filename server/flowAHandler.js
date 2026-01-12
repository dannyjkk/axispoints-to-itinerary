import dotenv from 'dotenv';
import OpenAI from 'openai';
import { resolveLocation } from './locationResolver.js';

dotenv.config();

const SEATS_API_KEY = process.env.SEATS_API_KEY || '';

const CARD_MULTIPLIER = {
  'Burgundy Private Credit Card': 0.8,
  'Magnus for Burgundy Credit Card': 0.8,
  'Magnus Credit Card (Standard)': 0.4,
  'Reserve Credit Card': 0.4,
  'Select Credit Card': 0.1,
  'Privilege Credit Card': 0.1,
  'Axis Bank Rewards Credit Card': 0.1,
  'Privilege Easy Credit Card': 0.05,
  'Axis Bank IndianOil Credit Card (regular)': 0.05,
  'IndianOil Easy Axis Bank Credit Card': 0.05,
  'Axis Bank My Zone Credit Card': 0.05,
  'Axis Bank My Zone Easy Credit Card': 0.05,
  'Axis Bank Signature Credit Card': 0.05,
  'Axis Bank Titanium Smart Traveller Credit Card': 0.05,
  'Axis Bank Pride Platinum Credit Card': 0.05,
  'Axis Bank Pride Signature Credit Card': 0.05,
};

const PROGRAM_CAPABILITY = {
  united: { level: 'LIVE_RELIABLE', name: 'United MileagePlus', disclaimer: null },
  aeroplan: { level: 'LIVE_RELIABLE', name: 'Air Canada Aeroplan', disclaimer: null },
  singapore: { level: 'LIMITED_RELIABLE', name: 'Singapore KrisFlyer', disclaimer: 'Saver-level availability only; results may be incomplete' },
  flyingblue: { level: 'LIMITED_RELIABLE', name: 'Air France–KLM Flying Blue', disclaimer: 'Saver-level availability only; results may be incomplete' },
};

const ALLOWED_SOURCES = Object.keys(PROGRAM_CAPABILITY);

let openaiClient = null;
const summaryCache = new Map(); // key: destination -> string[]
const summaryInFlight = new Map(); // key: destination -> Promise<string[]>
const durationSummaryCache = new Map(); // key: destination:nights -> string[]
const durationSummaryInFlight = new Map(); // key: destination:nights -> Promise<string[]>
const DEFAULT_SUMMARY = ['Explore the city at your own pace'];

function getOpenAIClient() {
  if (openaiClient) return openaiClient;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  openaiClient = new OpenAI({ apiKey: key });
  return openaiClient;
}

async function generateTripSummary(destinationName) {
  const key = destinationName || 'unknown';
  if (summaryCache.has(key)) return summaryCache.get(key);

  if (summaryInFlight.has(key)) return summaryInFlight.get(key);

  const task = (async () => {
    const client = getOpenAIClient();
    if (!client) return DEFAULT_SUMMARY;

    const prompt = `
You are generating a concise trip summary for a generic sightseeing, first-time visit.
Destination: ${destinationName || 'unknown'}

Return a JSON array of exactly 5 short bullet strings (one sentence each). No numbering, no emojis, no specific hotels or bookings. Focus on realistic day-by-day flow (arrival, central landmarks, culture/food, optional day trip, departure).`;

    try {
      const resp = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Return only JSON array of strings. No extra text.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      });

      const content = resp.choices?.[0]?.message?.content || '';
      console.log('[TripSummaryRaw]', {
        destinationCity: destinationName || 'unknown',
        rawOutput: content,
      });
      const parsed = JSON.parse(content);
      const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.bullets) ? parsed.bullets : Array.isArray(parsed?.summary) ? parsed.summary : parsed?.tripSummary;
      const bullets = Array.isArray(arr) ? arr : parsed?.airports ? [] : [];
      const cleaned = (bullets || []).map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean).slice(0, 5);
      const finalSummary = cleaned.length > 0 ? cleaned : DEFAULT_SUMMARY;
      const usedFallback = finalSummary.length === 1 && finalSummary[0] === DEFAULT_SUMMARY[0];
      console.log('[TripSummaryGenerated]', {
        destinationCity: destinationName || 'unknown',
        usedFallback,
      });
      return finalSummary;
    } catch (err) {
      console.error('trip summary error:', err?.message || err);
      return DEFAULT_SUMMARY;
    }
  })();

  summaryInFlight.set(key, task);
  try {
    const result = await task;
    summaryCache.set(key, result);
    return result;
  } finally {
    summaryInFlight.delete(key);
  }
}

/**
 * Generate trip summary for a specific destination and duration (nights)
 * Caches by destination:nights to avoid duplicate API calls
 */
async function generateTripSummaryWithDuration(destinationName, nights) {
  const key = `${destinationName || 'unknown'}:${nights || 3}`;
  if (durationSummaryCache.has(key)) return durationSummaryCache.get(key);

  if (durationSummaryInFlight.has(key)) return durationSummaryInFlight.get(key);

  const task = (async () => {
    const client = getOpenAIClient();
    if (!client) return DEFAULT_SUMMARY;

    const prompt = `
You are generating a concise trip summary for a ${nights}-night trip to ${destinationName || 'a destination'}.
This is for a first-time visitor doing general sightseeing.

Return a JSON array of exactly 5 short bullet strings (one sentence each). No numbering, no emojis, no specific hotels or bookings.
Tailor the itinerary to fit ${nights} nights:
- For 3 nights: Focus on must-see highlights and central attractions
- For 4-5 nights: Add a day trip or secondary neighborhood
- For 6+ nights: Include deeper exploration, local experiences, and relaxation time

Focus on realistic day-by-day flow appropriate for the trip length.`;

    try {
      const resp = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Return only JSON array of strings. No extra text.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      });

      const content = resp.choices?.[0]?.message?.content || '';
      console.log('[TripSummaryWithDurationRaw]', {
        destination: destinationName || 'unknown',
        nights,
        rawOutput: content,
      });
      const parsed = JSON.parse(content);
      const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.bullets) ? parsed.bullets : Array.isArray(parsed?.summary) ? parsed.summary : parsed?.tripSummary;
      const bullets = Array.isArray(arr) ? arr : [];
      const cleaned = (bullets || []).map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean).slice(0, 5);
      const finalSummary = cleaned.length > 0 ? cleaned : DEFAULT_SUMMARY;
      console.log('[TripSummaryWithDurationGenerated]', {
        destination: destinationName || 'unknown',
        nights,
        usedFallback: finalSummary.length === 1 && finalSummary[0] === DEFAULT_SUMMARY[0],
      });
      return finalSummary;
    } catch (err) {
      console.error('trip summary with duration error:', err?.message || err);
      return DEFAULT_SUMMARY;
    }
  })();

  durationSummaryInFlight.set(key, task);
  try {
    const result = await task;
    durationSummaryCache.set(key, result);
    return result;
  } finally {
    durationSummaryInFlight.delete(key);
  }
}

const ORIGIN_CODE = {
  Delhi: 'DEL',
  Mumbai: 'BOM',
  Bengaluru: 'BLR',
  Hyderabad: 'HYD',
  Chennai: 'MAA',
};

function cabinToCode(cabin) {
  const map = {
    Economy: 'Y',
    Business: 'J',
    'Premium Economy': 'W',
    First: 'F',
  };
  return map[cabin] || null;
}

function monthToDateRange(input) {
  if (!input || typeof input !== 'string') {
    const err = new Error('Invalid travelMonth: required');
    err.status = 400;
    throw err;
  }
  const trimmed = input.trim();
  let date;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    date = new Date(trimmed);
  } else {
    date = new Date(trimmed);
  }
  if (Number.isNaN(date.getTime())) {
    const err = new Error('Invalid travelMonth format');
    err.status = 400;
    throw err;
  }
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return {
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  };
}

export async function processFlowA(body = {}) {
  if (!SEATS_API_KEY) {
    const error = new Error('SEATS_API_KEY missing on server');
    error.status = 500;
    throw error;
  }

  const {
    edgePoints,
    origin,
    destination,
    travelMonth,
    cabin,
    cardDisplayName,
    onlyDirect,
  } = body;

  if (
    edgePoints === undefined ||
    !origin ||
    !destination ||
    !travelMonth ||
    !cabin ||
    !cardDisplayName
  ) {
    const err = new Error('Missing required fields');
    err.status = 400;
    throw err;
  }

  const multiplier = CARD_MULTIPLIER[cardDisplayName] ?? 0;
  const partnerMiles = Math.floor(Number(edgePoints) * multiplier);

  const originAirport = ORIGIN_CODE[origin] || origin;
  const { start_date, end_date } = monthToDateRange(travelMonth);
  const cabinCode = cabinToCode(cabin);
  if (!cabinCode) {
    const err = new Error('Invalid cabin');
    err.status = 400;
    err.detail = 'Cabin must be Economy, Business, Premium Economy, or First';
    throw err;
  }

  const resolved = await resolveLocation(destination);
  const resolvedAirports = Array.isArray(resolved?.airports) ? resolved.airports : [];
  const destinationAirport =
    resolvedAirports.length > 0
      ? resolvedAirports.map((a) => a.iata).join(',')
      : destination.trim();

  const params = new URLSearchParams({
    origin_airport: originAirport,
    destination_airport: destinationAirport,
    start_date,
    end_date,
    take: '500',
    include_trips: 'false',
    only_direct_flights: onlyDirect === true ? 'true' : 'false',
    include_filtered: 'false',
    sources: ALLOWED_SOURCES.join(','),
  });

  const seatsUrl = `https://seats.aero/partnerapi/search?${params.toString()}`;
  console.log('Seats request URL:', seatsUrl);

  let seatsResp;
  try {
    seatsResp = await fetch(seatsUrl, {
      headers: {
        'Content-Type': 'application/json',
        'Partner-Authorization': SEATS_API_KEY,
      },
    });
  } catch (fetchErr) {
    const detail = fetchErr?.message || 'fetch failed';
    const causeCode = fetchErr?.cause?.code;
    const err = new Error('Seats API fetch failed');
    err.status = 502;
    err.detail = detail;
    err.cause = causeCode;
    throw err;
  }

  if (!seatsResp.ok) {
    const text = await seatsResp.text();
    const err = new Error('Seats API error');
    err.status = seatsResp.status;
    err.detail = text;
    throw err;
  }

  const data = await seatsResp.json();
  const results = Array.isArray(data?.data) ? data.data : [];

  if (results.length > 0) {
    const preview = results.slice(0, 3).map((r) => ({
      Source: r.Source,
      YAvailableRaw: r?.YAvailableRaw,
      YMileageCostRaw: r?.YMileageCostRaw,
      YAvailable: r?.YAvailable,
      YMileageCost: r?.YMileageCost,
    }));
    console.log('Seats preview (first 3):', preview);
  }

  const mapped = results
    .map((r) => {
      const src = (r?.Source || '').toLowerCase();
      const capability = PROGRAM_CAPABILITY[src];
      return { r, src, capability };
    })
    .filter(({ capability }) => capability && (capability.level === 'LIVE_RELIABLE' || capability.level === 'LIMITED_RELIABLE'))
    .map(({ r, src, capability }) => {
      const isBusiness = cabinCode === 'J';
      const avail = isBusiness ? r?.JAvailableRaw : r?.YAvailableRaw;
      const rawMiles = isBusiness ? r?.JMileageCostRaw : r?.YMileageCostRaw;
      const cabinMiles = typeof rawMiles === 'number' ? rawMiles : Number(rawMiles);

      let dest = null;
      if (r?.destination_airport) {
        dest = r.destination_airport;
      } else if (r?.DestinationAirport) {
        dest = r.DestinationAirport;
      } else if (typeof r?.Route === 'string' && r.Route.includes('-')) {
        dest = r.Route.split('-')[1];
      } else if (r?.Route?.DestinationAirport) {
        dest = r.Route.DestinationAirport;
      }

      const stops = typeof r?.stops === 'number'
        ? r.stops
        : (isBusiness ? r?.JDirectRaw : r?.YDirectRaw) === true
          ? 0
          : null;

      const programName = capability?.name || 'Program';
      const disclaimer = capability?.disclaimer || null;

      const allowedMiles = Number.isFinite(cabinMiles) ? cabinMiles : 0;
      const withinBudget = avail === true && allowedMiles > 0 && allowedMiles <= partnerMiles;

      if (!withinBudget) return null;

      return {
        origin: originAirport,
        destination: dest,
        destinationName: resolvedAirports.find((a) => a.iata === dest)?.city || null,
        program: programName,
        programLevel: capability.level,
        disclaimer,
        cabin: cabinCode === 'J' ? 'Business' : 'Economy',
        mileageCost: allowedMiles,
        edgePointsRequired: Math.ceil(allowedMiles / (CARD_MULTIPLIER[cardDisplayName] || 1)),
        stops,
        tripSummary: [],
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.edgePointsRequired - b.edgePointsRequired);

  // Deduplicate: max 2 per destination (cheapest + cheapest non-stop if different)
  // Group by destination
  const byDest = new Map();
  for (const item of mapped) {
    const key = item.destinationName || item.destination || 'unknown';
    if (!byDest.has(key)) byDest.set(key, []);
    byDest.get(key).push(item);
  }

  // For each destination, pick: cheapest + cheapest non-stop (if different)
  const destGroups = [];
  for (const [destKey, items] of byDest) {
    // Items are already sorted by points, so first is cheapest
    const cheapest = items[0];
    const cheapestNonstop = items.find((i) => i.stops === 0);

    const selected = [];
    if (cheapest.stops === 0) {
      // Cheapest is already non-stop, show only that
      selected.push(cheapest);
    } else if (cheapestNonstop) {
      // Cheapest has stops, but non-stop exists - show both
      selected.push(cheapest, cheapestNonstop);
    } else {
      // No non-stop exists, show only cheapest
      selected.push(cheapest);
    }

    destGroups.push({
      destKey,
      cheapestPoints: cheapest.edgePointsRequired,
      items: selected,
    });
  }

  // Sort destination groups by their cheapest option
  destGroups.sort((a, b) => a.cheapestPoints - b.cheapestPoints);

  // Flatten groups (keeping same-destination items together) and cap at 10
  const deduplicated = [];
  for (const group of destGroups) {
    for (const item of group.items) {
      if (deduplicated.length >= 10) break;
      deduplicated.push(item);
    }
    if (deduplicated.length >= 10) break;
  }

  // Deduplicate trip summary generation per destination within a single request.
  // Without this, parallel Promise.all calls would all miss the cache and spam the LLM.
  const summaryPromiseByDestination = new Map();
  const getSummaryForDestination = (destKey) => {
    const key = destKey || 'unknown';
    if (summaryPromiseByDestination.has(key)) {
      return summaryPromiseByDestination.get(key);
    }
    const promise = generateTripSummary(key)
      .then((result) => {
        // Replace stored promise with a resolved one to avoid holding onto a long chain
        summaryPromiseByDestination.set(key, Promise.resolve(result));
        return result;
      })
      .catch((err) => {
        // Allow retries on failure by removing the failed entry
        summaryPromiseByDestination.delete(key);
        throw err;
      });
    summaryPromiseByDestination.set(key, promise);
    return promise;
  };

  const enriched = await Promise.all(
    deduplicated.map(async (item) => {
      const summary = await getSummaryForDestination(item.destinationName || item.destination);
      return {
        ...item,
        tripSummary: summary,
      };
    })
  );

  return {
    input: {
      start_date,
      end_date,
      origin_airport: originAirport,
      destination_airport: destinationAirport,
    },
    options: enriched,
  };
}

export function ping() {
  return { message: 'pong' };
}

export { generateTripSummaryWithDuration };

