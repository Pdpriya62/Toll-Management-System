import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import laneRoutes from './routes/lanes.js';
import rateRoutes from './routes/rates.js';
import reportRoutes from './routes/reports.js';
import vehicleRoutes from './routes/vehicles.js';
import { initSchema, seedData } from './models/schema.js';
import { initSocket } from './sockets/lane.js';

dotenv.config();

const app = express();
const server = createServer(app);

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/lanes', laneRoutes);
app.use('/api/rates', rateRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/vehicles', vehicleRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

initSocket(server);

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await initSchema();
    await seedData();

    server.listen(PORT, () => {
      console.log(`Backend running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();