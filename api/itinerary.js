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

module.exports = async function handler(req, res) {
  try {
    // Health check
    if (req.method === 'GET' && req.url && req.url.includes('/health')) {
      return res.status(200).json({ ok: true, route: '/api/itinerary', status: 'healthy' });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const body = req.body || {};
    requireFields(body, ['origin', 'destination']);

    const origin = String(body.origin);
    const destination = String(body.destination);
    const points = Number(body.points || 0);
    const days = Number(body.days || 3);

    const result = generateItinerary({ origin, destination, points, days });
    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ ok: false, error: err.message || 'Internal error' });
  }
};

