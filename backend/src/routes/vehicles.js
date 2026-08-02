import { Router } from 'express';
import { query } from '../config/db.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/blacklist', authMiddleware, roleMiddleware('supervisor'), async (req, res) => {
  try {
    const result = await query('SELECT * FROM blacklist ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch blacklist' }); }
});

router.post('/blacklist', authMiddleware, roleMiddleware('supervisor'), async (req, res) => {
  try {
    const { vehicleNumber, reason } = req.body;
    if (!vehicleNumber) return res.status(400).json({ error: 'vehicleNumber required' });
    const result = await query(
      'INSERT INTO blacklist (vehicle_number, reason) VALUES ($1, $2) RETURNING *',
      [vehicleNumber.toUpperCase(), reason]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Vehicle already blacklisted' });
    res.status(500).json({ error: 'Failed to add to blacklist' });
  }
});

router.delete('/blacklist/:vehicleNumber', authMiddleware, roleMiddleware('supervisor'), async (req, res) => {
  try {
    const { vehicleNumber } = req.params;
    await query('DELETE FROM blacklist WHERE vehicle_number = $1', [vehicleNumber.toUpperCase()]);
    res.json({ message: 'Removed from blacklist' });
  } catch (err) { res.status(500).json({ error: 'Failed to remove from blacklist' }); }
});

router.get('/exempt', authMiddleware, roleMiddleware('supervisor'), async (req, res) => {
  try {
    const result = await query('SELECT * FROM exempt_vehicles ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch exempt list' }); }
});

router.post('/exempt', authMiddleware, roleMiddleware('supervisor'), async (req, res) => {
  try {
    const { vehicleNumber, reason } = req.body;
    if (!vehicleNumber) return res.status(400).json({ error: 'vehicleNumber required' });
    const result = await query(
      'INSERT INTO exempt_vehicles (vehicle_number, reason) VALUES ($1, $2) RETURNING *',
      [vehicleNumber.toUpperCase(), reason]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Vehicle already in exempt list' });
    res.status(500).json({ error: 'Failed to add to exempt list' });
  }
});

router.delete('/exempt/:vehicleNumber', authMiddleware, roleMiddleware('supervisor'), async (req, res) => {
  try {
    const { vehicleNumber } = req.params;
    await query('DELETE FROM exempt_vehicles WHERE vehicle_number = $1', [vehicleNumber.toUpperCase()]);
    res.json({ message: 'Removed from exempt list' });
  } catch (err) { res.status(500).json({ error: 'Failed to remove from exempt list' }); }
});

export default router;