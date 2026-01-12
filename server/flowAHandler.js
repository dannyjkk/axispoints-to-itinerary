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
const summaryCache = new Map(); // key: dest|days -> string[]

function getOpenAIClient() {
  if (openaiClient) return openaiClient;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  openaiClient = new OpenAI({ apiKey: key });
  return openaiClient;
}

async function generateTripSummary(destinationName, days) {
  const key = `${destinationName || 'unknown'}|${days || 0}`;
  if (summaryCache.has(key)) return summaryCache.get(key);

  const client = getOpenAIClient();
  if (!client) {
    const fallback = ['Explore the city at your own pace'];
    summaryCache.set(key, fallback);
    return fallback;
  }

  const safeDays = Math.max(1, Math.min(Number(days) || 1, 30));
  const prompt = `
You are generating a concise trip summary for a generic sightseeing, first-time visit.
Destination: ${destinationName || 'unknown'}
Duration: ${safeDays} day(s)

Return a JSON array of 3-5 short bullet strings (one sentence each), max 5 bullets, no numbering, no emojis, no specific hotels or bookings. If duration < 5, reduce bullets accordingly. Focus on realistic day-by-day flow (arrival, central landmarks, culture/food, optional day trip, departure).`;

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
    const finalSummary = cleaned.length > 0 ? cleaned : ['Explore the city at your own pace'];
    const usedFallback = finalSummary.length === 1 && finalSummary[0] === 'Explore the city at your own pace';
    console.log('[TripSummaryGenerated]', {
      destinationCity: destinationName || 'unknown',
      durationDays: safeDays,
      usedFallback,
    });
    summaryCache.set(key, finalSummary);
    return finalSummary;
  } catch (err) {
    console.error('trip summary error:', err?.message || err);
    const fallback = ['Explore the city at your own pace'];
    summaryCache.set(key, fallback);
    return fallback;
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
    tripDuration,
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

      if (avail !== true || !Number.isFinite(cabinMiles) || cabinMiles <= 0 || cabinMiles > partnerMiles) {
        return null;
      }

      let dest = null;
      if (r?.destination_airport) {
        dest = r.destination_airport;
      } else if (r?.DestinationAirport) {
        dest = r.DestinationAirport;
      } else if (typeof r?.Route === 'string' && r.Route.includes('-')) {
        const parts = r.Route.split('-');
        dest = parts[1]?.trim() || null;
      } else if (r?.Route?.DestinationAirport) {
        dest = r.Route.DestinationAirport;
      }

      const match = resolvedAirports.find((a) => a.iata === dest);
      const destDisplay = match?.city || match?.iata || dest;

      const stops =
        typeof r?.stops === 'number'
          ? r.stops
          : (r?.YDirectRaw === true || r?.JDirectRaw === true) ? 0 : null;

      return {
        program:
          src === 'united'
            ? 'United MileagePlus'
            : src === 'aeroplan'
              ? 'Air Canada Aeroplan'
              : src === 'singapore'
                ? 'Singapore KrisFlyer'
                : src === 'flyingblue'
                  ? 'Air France–KLM Flying Blue'
                  : 'unknown',
        capability: capability?.level || 'EXPERIMENTAL',
        disclaimer: capability?.level === 'LIMITED_RELIABLE' ? capability?.disclaimer : null,
        mileageCost: cabinMiles,
        edgePointsRequired: multiplier ? Math.ceil(cabinMiles / multiplier) : cabinMiles,
        cabin: cabinCode === 'J' ? 'Business' : 'Economy',
        origin: originAirport,
        destination: dest,
        destinationName: destDisplay || null,
        stops,
        tripSummary: [],
        YAvailable: r.YAvailable,
        JAvailable: r.JAvailable,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.edgePointsRequired - b.edgePointsRequired);

  const summaryByDest = new Map();
  for (const item of mapped) {
    const keyDest = item.destinationName || item.destination || destinationAirport;
    if (!summaryByDest.has(keyDest)) {
      const summary = await generateTripSummary(keyDest, tripDuration);
      summaryByDest.set(keyDest, summary);
    }
  }

  const mappedWithSummary = mapped.map((item) => {
    const keyDest = item.destinationName || item.destination || destinationAirport;
    const summary = summaryByDest.get(keyDest) || ['Explore the city at your own pace'];
    return { ...item, tripSummary: summary };
  });

  return {
    input: {
      edgePoints: Number(edgePoints),
      cardDisplayName,
      multiplier,
      partnerMiles,
      originAirport,
      destinationAirport,
      start_date,
      end_date,
      cabin: cabinCode,
    },
    options: mappedWithSummary,
  };
}

export function ping() {
  return { message: 'pong' };
}
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
const summaryCache = new Map(); // key: dest|days -> string[]

function getOpenAIClient() {
  if (openaiClient) return openaiClient;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  openaiClient = new OpenAI({ apiKey: key });
  return openaiClient;
}

async function generateTripSummary(destinationName, days) {
  const key = `${destinationName || 'unknown'}|${days || 0}`;
  if (summaryCache.has(key)) return summaryCache.get(key);

  const client = getOpenAIClient();
  if (!client) {
    const fallback = ['Explore the city at your own pace'];
    summaryCache.set(key, fallback);
    return fallback;
  }

  const safeDays = Math.max(1, Math.min(Number(days) || 1, 30));
  const prompt = `
You are generating a concise trip summary for a generic sightseeing, first-time visit.
Destination: ${destinationName || 'unknown'}
Duration: ${safeDays} day(s)

Return a JSON array of 3-5 short bullet strings (one sentence each), max 5 bullets, no numbering, no emojis, no specific hotels or bookings. If duration < 5, reduce bullets accordingly. Focus on realistic day-by-day flow (arrival, central landmarks, culture/food, optional day trip, departure).`;

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
    const finalSummary = cleaned.length > 0 ? cleaned : ['Explore the city at your own pace'];
    const usedFallback = finalSummary.length === 1 && finalSummary[0] === 'Explore the city at your own pace';
    console.log('[TripSummaryGenerated]', {
      destinationCity: destinationName || 'unknown',
      durationDays: safeDays,
      usedFallback,
    });
    summaryCache.set(key, finalSummary);
    return finalSummary;
  } catch (err) {
    console.error('trip summary error:', err?.message || err);
    const fallback = ['Explore the city at your own pace'];
    summaryCache.set(key, fallback);
    return fallback;
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

function monthToDateRange(monthLabel) {
  if (!monthLabel) return { start_date: '', end_date: '' };
  const date = new Date(`${monthLabel} 1`);
  if (Number.isNaN(date.getTime())) return { start_date: '', end_date: '' };
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
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
    tripDuration,
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

  const enriched = await Promise.all(
    mapped.map(async (item) => {
      const summary = await generateTripSummary(item.destinationName || item.destination, tripDuration);
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

