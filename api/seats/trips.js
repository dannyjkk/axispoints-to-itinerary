/**
 * GET /api/seats/trips?id=<availabilityId>
 *
 * Proxy endpoint to Seats.aero Get Trips API.
 * Used for debugging and future direct access.
 */

const SEATS_API_KEY = process.env.SEATS_API_KEY || '';

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check API key
  if (!SEATS_API_KEY) {
    return res.status(500).json({ error: 'SEATS_API_KEY missing on server' });
  }

  // Parse query param
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

