import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

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
    const { edgePoints, origin, destination, travelMonth, cabin, cardDisplayName } = req.body || {};

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

    // TODO: add LLM destination resolution; for now assume user input is destination airport or free text
    const destinationAirport = destination.trim();

    const params = new URLSearchParams({
      origin_airport: originAirport,
      destination_airport: destinationAirport,
      start_date,
      end_date,
      take: '500',
      include_trips: 'false',
      only_direct_flights: 'false',
      include_filtered: 'false',
      sources: 'united,singapore',
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

    const filtered = results
      .filter((r) => {
        const src = (r?.Source || '').toLowerCase();
        return src === 'united' || src === 'singapore';
      })
      .map((r) => {
        const raw = r?.YMileageCostRaw;
        const cabinMiles = typeof raw === 'number' ? raw : Number(raw);
        return { r, cabinMiles, yAvail: r?.YAvailableRaw, src: (r?.Source || '').toLowerCase() };
      })
      .filter(({ yAvail, cabinMiles }) => yAvail === true && Number.isFinite(cabinMiles) && cabinMiles > 0)
      .filter(({ cabinMiles }) => cabinMiles <= partnerMiles)
      .slice(0, 5)
      .map(({ r, cabinMiles, src }) => ({
        program: src === 'united' ? 'United MileagePlus' : src === 'singapore' ? 'Singapore KrisFlyer' : 'unknown',
        mileageCost: cabinMiles,
        edgePointsRequired: multiplier ? Math.ceil(cabinMiles / multiplier) : cabinMiles,
        cabin: 'Economy',
        origin: originAirport,
        destination: destinationAirport,
        stops: r.stops,
        YAvailable: r.YAvailable,
        JAvailable: r.JAvailable,
      }));

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
      options: filtered,
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


