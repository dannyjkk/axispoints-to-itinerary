import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { processFlowA, ping } from './flowAHandler.js';
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

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on http://localhost:${PORT}`);
});

export { app };