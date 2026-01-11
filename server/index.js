import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { resolveLocation } from './locationResolver.js';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const SEATS_API_KEY = process.env.SEATS_API_KEY || '';

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

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
    const wasCached = summaryCache.has(key);
    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Return only JSON array of strings. No extra text.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = resp.choices?.[0]?.message?.content || '';
    // Debug: raw LLM output for testing
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
    if (!wasCached) {
      // eslint-disable-next-line no-console
      console.log('[TripSummaryGenerated]', {
        destinationCity: destinationName || 'unknown',
        durationDays: safeDays,
        usedFallback,
      });
    }
    summaryCache.set(key, finalSummary);
    return finalSummary;
  } catch (err) {
    // eslint-disable-next-line no-console
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

const cabinToCode = (cabin = '') => {
  const normalized = cabin.trim().toLowerCase();
  const map = {
    economy: 'Y',
    business: 'J',
    'premium economy': 'W',
    first: 'F',
  };
  return map[normalized];
};

const formatDateLocal = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const monthToDateRange = (monthIso) => {
  const d = new Date(monthIso);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start_date: formatDateLocal(start), end_date: formatDateLocal(end) };
};

app.post('/flowA', async (req, res) => {
  if (!SEATS_API_KEY) {
    return res.status(500).json({ error: 'SEATS_API_KEY missing on server' });
  }

  try {
    const {
      edgePoints,
      origin,
      destination,
      travelMonth,
      cabin,
      cardDisplayName,
      onlyDirect,
      tripDuration,
    } = req.body || {};

    if (
      edgePoints === undefined ||
      !origin ||
      !destination ||
      !travelMonth ||
      !cabin ||
      !cardDisplayName
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const multiplier = CARD_MULTIPLIER[cardDisplayName] ?? 0;
    const partnerMiles = Math.floor(Number(edgePoints) * multiplier);

    const originAirport = ORIGIN_CODE[origin] || origin;
    const { start_date, end_date } = monthToDateRange(travelMonth);
    const cabinCode = cabinToCode(cabin);
    if (!cabinCode) {
      return res.status(400).json({ error: 'Invalid cabin', detail: 'Cabin must be Economy, Business, Premium Economy, or First' });
    }

    // Resolve destination to airports (LLM-backed, with fallback)
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
      return res.status(502).json({
        error: 'Seats API fetch failed',
        detail,
        cause: causeCode,
      });
    }

    if (!seatsResp.ok) {
      const text = await seatsResp.text();
      return res.status(seatsResp.status).json({ error: 'Seats API error', detail: text });
    }

    const data = await seatsResp.json();
    const results = Array.isArray(data?.data) ? data.data : [];

    // Debug snapshot to understand availability/cost fields
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
          const parts = r.Route.split('-');
          dest = parts[1]?.trim() || null;
        } else if (r?.Route?.DestinationAirport) {
          dest = r.Route.DestinationAirport;
        }

        const match = resolvedAirports.find((a) => a.iata === dest);
        const destDisplay = match?.city || match?.iata || dest;

        return { r, src, capability, cabinMiles, avail, dest, destDisplay };
      })
      .filter(({ avail, cabinMiles }) => avail === true && Number.isFinite(cabinMiles) && cabinMiles > 0)
      .filter(({ cabinMiles }) => cabinMiles <= partnerMiles)
      .slice(0, 5);

    // Precompute summaries once per destination display/dest
    const summaryByDest = new Map();
    for (const item of mapped) {
      const keyDest = item.destDisplay || item.dest || destinationAirport;
      if (!summaryByDest.has(keyDest)) {
        const summary =
          (await generateTripSummary(keyDest, tripDuration)) || ['Explore the city at your own pace'];
        summaryByDest.set(keyDest, summary);
      }
    }

    const mappedWithSummary = mapped.map((item) => {
      const keyDest = item.destDisplay || item.dest || destinationAirport;
      const summary = summaryByDest.get(keyDest) || ['Explore the city at your own pace'];

      const derivedStops =
        typeof item.r?.stops === 'number'
          ? item.r.stops
          : (item.r?.YDirectRaw === true || item.r?.JDirectRaw === true) ? 0 : null;

      return {
        program:
          item.src === 'united'
            ? 'United MileagePlus'
            : item.src === 'aeroplan'
              ? 'Air Canada Aeroplan'
              : item.src === 'singapore'
                ? 'Singapore KrisFlyer'
                : item.src === 'flyingblue'
                  ? 'Air France–KLM Flying Blue'
                  : 'unknown',
        capability: item.capability?.level || 'EXPERIMENTAL',
        disclaimer: item.capability?.level === 'LIMITED_RELIABLE' ? item.capability?.disclaimer : null,
        mileageCost: item.cabinMiles,
        edgePointsRequired: multiplier ? Math.ceil(item.cabinMiles / multiplier) : item.cabinMiles,
        cabin: cabinCode === 'J' ? 'Business' : 'Economy',
        origin: originAirport,
        destination: item.dest,
        destinationName: item.destDisplay || null,
        stops: derivedStops,
        tripSummary: summary,
        YAvailable: item.r.YAvailable,
        JAvailable: item.r.JAvailable,
      };
    });

    return res.json({
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
    });
  } catch (err) {
    console.error('FlowA error:', err);
    const detail = err?.message || 'unknown error';
    const cause = err?.cause?.code;
    return res.status(500).json({ error: 'Server error', detail, cause });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


