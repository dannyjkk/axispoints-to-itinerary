import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { processFlowA, ping, generateTripSummaryWithDuration } from './flowAHandler.js';
import { handleDatePairs, handleTrips } from './seatsHandlers.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const sendPing = (_req, res) => {
  res.status(200).json(ping());
};

const sendHealth = (_req, res) => {
  res.status(200).json({ status: 'ok' });
};

const handleGenerate = async (req, res) => {
  try {
    const result = await processFlowA(req.body || {});
    res.status(200).json(result);
  } catch (err) {
    const status = Number(err?.status) || 500;
    const payload = {
      error: err?.message || 'Internal error',
    };
    if (err?.detail) payload.detail = err.detail;
    if (err?.cause) payload.cause = err.cause;
    res.status(status).json(payload);
  }
};

app.get('/ping', sendPing);
app.get('/api/ping', sendPing);
app.get('/health', sendHealth);
app.get('/api/health', sendHealth);
app.post('/flowA', handleGenerate); // legacy path
app.post('/api/generate-itinerary', handleGenerate);
app.get('/api/seats/date-pairs', handleDatePairs);
app.get('/api/seats/trips', handleTrips);

/**
 * GET /api/trip-summary
 * Query params: destination (string), nights (number)
 * Returns: { summary: string[] }
 */
app.get('/api/trip-summary', async (req, res) => {
  const { destination, nights } = req.query;
  
  if (!destination) {
    return res.status(400).json({ error: 'Missing destination parameter' });
  }
  
  const nightsNum = parseInt(nights, 10) || 3;
  
  try {
    const summary = await generateTripSummaryWithDuration(destination, nightsNum);
    res.status(200).json({ summary });
  } catch (err) {
    console.error('[trip-summary error]', err);
    res.status(500).json({ error: err?.message || 'Failed to generate trip summary' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on http://localhost:${PORT}`);
});

export { app };