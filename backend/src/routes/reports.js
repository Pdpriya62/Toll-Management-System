import { Router } from 'express';
import { query } from '../config/db.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/daily', authMiddleware, roleMiddleware('supervisor'), async (req, res) => {
  try {
    const { plazaId, date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    let where = 'WHERE DATE(t.initiated_at) = $1';
    const params = [dateStr];
    if (plazaId) {
      where += ' AND t.plaza_id = $2';
      params.push(plazaId);
    }

    const result = await query(
      `SELECT
         t.plaza_id,
         p.name as plaza_name,
         COUNT(*) as total_transactions,
         COALESCE(SUM(t.fee), 0) as total_revenue,
         COUNT(*) FILTER (WHERE t.payment_mode = 'CASH') as cash_count,
         COALESCE(SUM(t.fee) FILTER (WHERE t.payment_mode = 'CASH'), 0) as cash_revenue,
         COUNT(*) FILTER (WHERE t.payment_mode = 'QR') as qr_count,
         COALESCE(SUM(t.fee) FILTER (WHERE t.payment_mode = 'QR'), 0) as qr_revenue,
         COUNT(*) FILTER (WHERE t.payment_mode = 'FASTAG') as fastag_count,
         COALESCE(SUM(t.fee) FILTER (WHERE t.payment_mode = 'FASTAG'), 0) as fastag_revenue,
         COUNT(*) FILTER (WHERE t.status = 'EXCEPTION') as exceptions
       FROM transactions t
       JOIN plazas p ON t.plaza_id = p.id
       ${where}
       GROUP BY t.plaza_id, p.name
       ORDER BY t.plaza_id`,
      params
    );

    res.json({ date: dateStr, plazas: result.rows });
  } catch (err) {
    console.error('Daily report error:', err);
    res.status(500).json({ error: 'Failed to generate daily report' });
  }
});

router.get('/lane-summary', authMiddleware, roleMiddleware('supervisor'), async (req, res) => {
  try {
    const { plazaId, date, laneId } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    let where = 'WHERE DATE(t.initiated_at) = $1';
    const params = [dateStr];
    if (laneId) {
      where += ' AND t.lane_id = $2';
      params.push(laneId);
    } else if (plazaId) {
      where += ' AND t.plaza_id = $2';
      params.push(plazaId);
    }

    const result = await query(
      `SELECT
         t.lane_id,
         l.lane_number,
         COUNT(*) as total_transactions,
         COALESCE(SUM(t.fee), 0) as total_revenue,
         COUNT(*) FILTER (WHERE t.payment_mode = 'CASH') as cash_count,
         COALESCE(SUM(t.fee) FILTER (WHERE t.payment_mode = 'CASH'), 0) as cash_revenue,
         COUNT(*) FILTER (WHERE t.payment_mode = 'QR') as qr_count,
         COALESCE(SUM(t.fee) FILTER (WHERE t.payment_mode = 'QR'), 0) as qr_revenue,
         COUNT(*) FILTER (WHERE t.payment_mode = 'FASTAG') as fastag_count,
         COALESCE(SUM(t.fee) FILTER (WHERE t.payment_mode = 'FASTAG'), 0) as fastag_revenue,
         COUNT(*) FILTER (WHERE t.status = 'EXCEPTION') as exceptions,
         COUNT(*) FILTER (WHERE t.status = 'COMPLETED') as completed,
         COUNT(*) FILTER (WHERE t.status = 'SETTLED') as settled
       FROM transactions t
       JOIN lanes l ON t.lane_id = l.id
       ${where}
       GROUP BY t.lane_id, l.lane_number
       ORDER BY l.lane_number`,
      params
    );

    res.json({ date: dateStr, lanes: result.rows });
  } catch (err) {
    console.error('Lane summary error:', err);
    res.status(500).json({ error: 'Failed to generate lane summary' });
  }
});

router.get('/shift', authMiddleware, roleMiddleware('supervisor'), async (req, res) => {
  try {
    const { shiftId } = req.query;
    if (!shiftId) return res.status(400).json({ error: 'shiftId required' });

    const shift = await query('SELECT * FROM shifts WHERE id = $1', [shiftId]);
    if (!shift.rows[0]) return res.status(404).json({ error: 'Shift not found' });

    const txns = await query(
      `SELECT t.*, u.username as operator_name
       FROM transactions t
       LEFT JOIN users u ON t.operator_id = u.id
       WHERE t.shift_id = $1
       ORDER BY t.initiated_at`,
      [shiftId]
    );

    const cashDeclared = parseFloat(shift.rows[0].declared_cash || 0);
    const qrDeclared = parseFloat(shift.rows[0].declared_qr || 0);
    const cashSystem = parseFloat(shift.rows[0].system_cash || 0);
    const qrSystem = parseFloat(shift.rows[0].system_qr || 0);

    res.json({
      shift: shift.rows[0],
      transactions: txns.rows,
      reconciliation: {
        cash: { declared: cashDeclared, system: cashSystem, diff: cashDeclared - cashSystem },
        qr: { declared: qrDeclared, system: qrSystem, diff: qrDeclared - qrSystem },
      },
    });
  } catch (err) {
    console.error('Shift report error:', err);
    res.status(500).json({ error: 'Failed to generate shift report' });
  }
});

router.get('/export/csv', authMiddleware, roleMiddleware('supervisor'), async (req, res) => {
  try {
    const { plazaId, fromDate, toDate } = req.query;
    if (!fromDate || !toDate) return res.status(400).json({ error: 'fromDate and toDate required' });

    let where = 'WHERE DATE(t.initiated_at) BETWEEN $1 AND $2';
    const params = [fromDate, toDate];
    if (plazaId) {
      where += ' AND t.plaza_id = $3';
      params.push(plazaId);
    }

    const result = await query(
      `SELECT
         t.id, t.vehicle_number, t.vehicle_class, t.fee, t.payment_mode, t.status,
         t.initiated_at, t.completed_at,
         l.lane_number, p.code as plaza_code, u.username as operator_name
       FROM transactions t
       JOIN lanes l ON t.lane_id = l.id
       JOIN plazas p ON t.plaza_id = p.id
       LEFT JOIN users u ON t.operator_id = u.id
       ${where}
       ORDER BY t.initiated_at`,
      params
    );

    const headers = ['Transaction ID', 'Vehicle Number', 'Vehicle Class', 'Fee', 'Payment Mode', 'Status', 'Initiated At', 'Completed At', 'Lane', 'Plaza', 'Operator'];
    const rows = result.rows.map(r => [
      r.id, r.vehicle_number || '', r.vehicle_class, r.fee, r.payment_mode, r.status,
      r.initiated_at, r.completed_at || '', r.lane_number, r.plaza_code, r.operator_name || ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="transactions-${fromDate}-to-${toDate}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

export default router;