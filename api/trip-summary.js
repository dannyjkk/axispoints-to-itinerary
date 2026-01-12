/**
 * GET /api/trip-summary
 * 
 * Generates a trip summary for a destination + duration using OpenAI.
 * 
 * Query params:
 *   destination - City/destination name (required)
 *   nights      - Number of nights (default 3)
 */

import { generateTripSummaryWithDuration } from '../server/flowAHandler.js';

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { destination, nights } = req.query;

  if (!destination) {
    return res.status(400).json({ error: 'Missing destination parameter' });
  }

  const nightsNum = parseInt(nights, 10) || 3;

  try {
    const summary = await generateTripSummaryWithDuration(destination, nightsNum);
    return res.status(200).json({ summary });
  } catch (err) {
    console.error('[trip-summary error]', err);
    return res.status(500).json({ error: err?.message || 'Failed to generate trip summary' });
  }
}

