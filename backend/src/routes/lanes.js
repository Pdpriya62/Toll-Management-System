import { Router } from 'express';
import { query, getClient } from '../config/db.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';
import { calculateFee, processTransaction, transitionTransaction, getTransactions, getDailySummary } from '../services/fee.js';
import { emitLaneEvent } from '../sockets/lane.js';

const router = Router();

router.post('/event', authMiddleware, roleMiddleware('operator'), async (req, res) => {
  try {
    const { laneId, vehicleClass, vehicleNumber, paymentMode, evidenceRef } = req.body;
    const operatorId = req.user.id;

    if (!laneId || !vehicleClass) {
      return res.status(400).json({ error: 'laneId and vehicleClass required' });
    }

    const fee = await calculateFee(laneId, vehicleClass);
    const transaction = await processTransaction({
      laneId,
      vehicleClass,
      vehicleNumber,
      fee,
      paymentMode: paymentMode || 'CASH',
      evidenceRef,
      operatorId,
    });

    emitLaneEvent(laneId, 'transaction_created', transaction);
    res.status(201).json(transaction);
  } catch (err) {
    console.error('Lane event error:', err);
    res.status(500).json({ error: err.message || 'Failed to process lane event' });
  }
});

router.patch('/:id/transition', authMiddleware, roleMiddleware('operator', 'supervisor'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, evidenceRef } = req.body;
    if (!status) return res.status(400).json({ error: 'status required' });

    const transaction = await transitionTransaction(id, status, req.user.id, evidenceRef);
    emitLaneEvent(transaction.lane_id, 'transaction_updated', transaction);
    res.json(transaction);
  } catch (err) {
    console.error('Transition error:', err);
    res.status(400).json({ error: err.message });
  }
});

router.get('/:laneId/status', authMiddleware, async (req, res) => {
  try {
    const { laneId } = req.params;
    const lane = await query(
      `SELECT l.*, p.code as plaza_code FROM lanes l JOIN plazas p ON l.plaza_id = p.id WHERE l.id = $1`,
      [laneId]
    );
    if (!lane.rows[0]) return res.status(404).json({ error: 'Lane not found' });

    const counts = await query(
      `SELECT status, COUNT(*) as count FROM transactions WHERE lane_id = $1 AND DATE(initiated_at) = CURRENT_DATE GROUP BY status`,
      [laneId]
    );

    res.json({ lane: lane.rows[0], todayCounts: counts.rows });
  } catch (err) {
    console.error('Lane status error:', err);
    res.status(500).json({ error: 'Failed to fetch lane status' });
  }
});

router.get('/:laneId/transactions', authMiddleware, async (req, res) => {
  try {
    const { laneId } = req.params;
    const transactions = await getTransactions({
      laneId,
      status: req.query.status,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
    });
    res.json(transactions);
  } catch (err) {
    console.error('Transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

router.get('/:laneId/summary', authMiddleware, async (req, res) => {
  try {
    const { laneId } = req.params;
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const summary = await getDailySummary(laneId, date);
    res.json(summary);
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

export default router;