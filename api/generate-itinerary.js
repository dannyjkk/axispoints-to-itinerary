import { processFlowA } from '../server/flowAHandler.js';

export default async function handler(req, res) {
  try {
    const result = await processFlowA(req.body || {});
    res.status(200).json(result);
  } catch (err) {
    const status = err?.status || 500;
    res.status(status).json({ error: err?.message || 'Internal error', detail: err?.detail });
  }
}

