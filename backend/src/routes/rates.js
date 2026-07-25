import { Router } from 'express';
import { query, getClient } from '../config/db.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { plazaId } = req.query;
    const where = plazaId ? 'WHERE plaza_id = $1' : '';
    const params = plazaId ? [plazaId] : [];
    const result = await query(
      `SELECT * FROM rate_cards ${where} ORDER BY vehicle_class, effective_from DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get rates error:', err);
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

router.post('/', authMiddleware, roleMiddleware('supervisor'), async (req, res) => {
  try {
    const { plazaId, vehicleClass, fee, effectiveFrom, effectiveTo } = req.body;
    if (!plazaId || !vehicleClass || !fee) {
      return res.status(400).json({ error: 'plazaId, vehicleClass, and fee required' });
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO rate_cards (plaza_id, vehicle_class, fee, effective_from, effective_to)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [plazaId, vehicleClass, fee, effectiveFrom || new Date(), effectiveTo || null]
      );
      await logAudit(client, 'rate_cards', result.rows[0].id, 'CREATE', null, result.rows[0], req.user.id);
      await client.query('COMMIT');
      res.status(201).json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Rate card for this vehicle class already exists' });
    }
    console.error('Create rate error:', err);
    res.status(500).json({ error: 'Failed to create rate' });
  }
});

router.patch('/:id', authMiddleware, roleMiddleware('supervisor'), async (req, res) => {
  try {
    const { id } = req.params;
    const { fee, effectiveTo } = req.body;

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const old = await client.query('SELECT * FROM rate_cards WHERE id = $1', [id]);
      if (!old.rows[0]) return res.status(404).json({ error: 'Rate not found' });

      const result = await client.query(
        `UPDATE rate_cards SET fee = COALESCE($1, fee), effective_to = COALESCE($2, effective_to) WHERE id = $3 RETURNING *`,
        [fee, effectiveTo, id]
      );
      await logAudit(client, 'rate_cards', id, 'UPDATE', old.rows[0], result.rows[0], req.user.id);
      await client.query('COMMIT');
      res.json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update rate error:', err);
    res.status(500).json({ error: 'Failed to update rate' });
  }
});

router.delete('/:id', authMiddleware, roleMiddleware('supervisor'), async (req, res) => {
  try {
    const { id } = req.params;
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const old = await client.query('SELECT * FROM rate_cards WHERE id = $1', [id]);
      if (!old.rows[0]) return res.status(404).json({ error: 'Rate not found' });

      await client.query('DELETE FROM rate_cards WHERE id = $1', [id]);
      await logAudit(client, 'rate_cards', id, 'DELETE', old.rows[0], null, req.user.id);
      await client.query('COMMIT');
      res.json({ message: 'Rate deleted' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete rate error:', err);
    res.status(500).json({ error: 'Failed to delete rate' });
  }
});

export default router;