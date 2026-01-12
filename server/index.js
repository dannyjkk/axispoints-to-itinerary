import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { processFlowA, ping } from './flowAHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/ping', (_req, res) => {
  res.json(ping());
});

app.get('/api/ping', (_req, res) => {
  res.json(ping());
});

app.post('/flowA', async (req, res) => {
  try {
    const result = await processFlowA(req.body || {});
    return res.status(200).json(result);
  } catch (err) {
    const status = err?.status || 500;
    return res.status(status).json({ error: err?.message || 'Internal error', detail: err?.detail });
  }
});

app.post('/api/generate-itinerary', async (req, res) => {
  try {
    const result = await processFlowA(req.body || {});
    return res.status(200).json(result);
  } catch (err) {
    const status = err?.status || 500;
    return res.status(status).json({ error: err?.message || 'Internal error', detail: err?.detail });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT}`);
});
