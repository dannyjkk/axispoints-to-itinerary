const activities = [
  'City walking tour',
  'Local museum visit',
  'Popular viewpoint',
  'Local cuisine tasting',
  'Relaxing park time',
  'Shopping / market visit',
];

function requireFields(obj, fields = []) {
  const missing = fields.filter((f) => obj[f] === undefined || obj[f] === null || obj[f] === '');
  if (missing.length) {
    const err = new Error(`Missing required fields: ${missing.join(', ')}`);
    err.status = 400;
    throw err;
  }
}

function generateItinerary({ origin, destination, points = 0, days = 3 }) {
  const safeDays = Math.max(1, Math.floor(days || 1));
  const safePoints = Math.max(0, Math.floor(points || 0));
  const basePerDay = safeDays > 0 ? Math.max(1, Math.floor(safePoints / safeDays)) : 1;
  const perDayPoints =
    safePoints > 0 && basePerDay > safePoints ? safePoints : basePerDay;
  const itinerary = [];
  for (let d = 1; d <= safeDays; d++) {
    const picks = [];
    picks.push(activities[(d - 1) % activities.length]);
    picks.push(activities[d % activities.length]);
    const hotelTier =
      points > 100000 ? 'Premium hotel' : points > 50000 ? 'Comfort hotel' : 'Budget hotel';
    itinerary.push({
      day: d,
      title: `Day ${d}: ${origin} → ${destination}`,
      activities: picks,
      suggestedHotel: `${hotelTier} near center`,
      estimatedPointsRequiredToday: perDayPoints,
    });
  }
  return {
    meta: {
      origin,
      destination,
      totalDays: safeDays,
      pointsUsedEstimate: Math.min(safePoints, perDayPoints * safeDays),
    },
    days: itinerary,
  };
}

// ---- Vercel Serverless Handler ----
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const path = url.pathname;

    // Health check
    if (req.method === 'GET' && path === '/api/itinerary/health') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true, route: '/api/itinerary', status: 'healthy' }));
    }

    // Only POST allowed
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    }

    // Read raw body
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    const data = JSON.parse(body || '{}');

    requireFields(data, ['origin', 'destination']);

    const origin = String(data.origin);
    const destination = String(data.destination);

    const pointsRaw = Number(data.points ?? 0);
    if (!Number.isFinite(pointsRaw)) {
      const err = new Error('Invalid points: must be a number');
      err.status = 400;
      throw err;
    }
    const points = pointsRaw;

    const daysRaw = Number(data.days ?? 3);
    if (!Number.isFinite(daysRaw) || daysRaw < 1) {
      const err = new Error('Invalid days: must be a positive number');
      err.status = 400;
      throw err;
    }
    const days = Math.max(1, Math.floor(daysRaw));

    const result = generateItinerary({ origin, destination, points, days });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true, data: result }));

  } catch (err) {
    res.statusCode = err.status || 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: err.message || 'Internal error' }));
  }
};
