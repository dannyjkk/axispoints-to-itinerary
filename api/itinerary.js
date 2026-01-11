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
  const perDayPoints = Math.max(1, Math.floor(points / (days || 1)));
  const itinerary = [];
  for (let d = 1; d <= days; d++) {
    const picks = [];
    picks.push(activities[(d - 1) % activities.length]);
    picks.push(activities[(d + 1) % activities.length]);
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
      totalDays: days,
      pointsUsedEstimate: perDayPoints * days,
    },
    days: itinerary,
  };
}

// ---- Vercel Serverless Handler ----
module.exports = async function handler(req, res) {
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
    const points = Number(data.points || 0);
    const days = Number(data.days || 3);

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
