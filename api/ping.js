import { ping } from '../server/flowAHandler.js';

export default async function handler(_req, res) {
  res.status(200).json(ping());
}
export default async function handler(_req, res) {
  res.status(200).json({ message: 'pong' });
}

