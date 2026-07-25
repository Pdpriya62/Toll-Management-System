import { query, getClient } from '../config/db.js';
import { logAudit } from './audit.js';

const TRANSITIONS = {
  INITIATED: ['VALIDATED', 'VOIDED'],
  VALIDATED: ['AUTHORIZED', 'VOIDED'],
  AUTHORIZED: ['COMPLETED', 'VOIDED'],
  COMPLETED: ['SETTLED', 'EXCEPTION'],
  SETTLED: [],
  EXCEPTION: ['SETTLED', 'VOIDED'],
  VOIDED: [],
};

export async function calculateFee(laneId, vehicleClass) {
  const result = await query(
    `SELECT fee FROM rate_cards
     WHERE plaza_id = (SELECT plaza_id FROM lanes WHERE id = $1)
       AND vehicle_class = $2
       AND effective_from <= CURRENT_DATE
       AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
     ORDER BY effective_from DESC LIMIT 1`,
    [laneId, vehicleClass]
  );

  if (!result.rows[0]) {
    throw new Error(`No rate card found for vehicle class ${vehicleClass} on lane ${laneId}`);
  }

  return parseFloat(result.rows[0].fee);
}

export async function processTransaction({ laneId, vehicleClass, vehicleNumber, fee, paymentMode, evidenceRef, operatorId }) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO transactions (lane_id, vehicle_class, vehicle_number, fee, payment_mode, evidence_ref, operator_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'INITIATED')
       RETURNING *`,
      [laneId, vehicleClass, vehicleNumber, fee, paymentMode, evidenceRef, operatorId]
    );

    const transaction = result.rows[0];

    await logAudit(client, 'transactions', transaction.id, 'CREATE', null, transaction, operatorId);

    await client.query('COMMIT');
    return transaction;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function transitionTransaction(transactionId, newStatus, userId, evidenceRef = null) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const current = await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [transactionId]);
    if (!current.rows[0]) {
      throw new Error('Transaction not found');
    }

    const txn = current.rows[0];
    const allowed = TRANSITIONS[txn.status] || [];

    if (!allowed.includes(newStatus)) {
      throw new Error(`Invalid transition from ${txn.status} to ${newStatus}`);
    }

    const updates = { status: newStatus };
    const timestampFields = {
      VALIDATED: 'validated_at',
      AUTHORIZED: 'authorized_at',
      COMPLETED: 'completed_at',
      SETTLED: 'settled_at',
    };

    if (timestampFields[newStatus]) {
      updates[timestampFields[newStatus]] = new Date();
    }
    if (evidenceRef) {
      updates.evidence_ref = evidenceRef;
    }
    if (newStatus === 'COMPLETED' || newStatus === 'SETTLED') {
      updates.supervisor_id = userId;
    }

    const setClause = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = [transactionId, ...Object.values(updates)];

    const result = await client.query(
      `UPDATE transactions SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values
    );

    await logAudit(client, 'transactions', transactionId, 'STATUS_CHANGE', txn, result.rows[0], userId);

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getTransactions(filters = {}) {
  let where = 'WHERE 1=1';
  const params = [];
  let paramIdx = 1;

  if (filters.laneId) {
    where += ` AND lane_id = $${paramIdx++}`;
    params.push(filters.laneId);
  }
  if (filters.status) {
    where += ` AND status = $${paramIdx++}`;
    params.push(filters.status);
  }
  if (filters.fromDate) {
    where += ` AND initiated_at >= $${paramIdx++}`;
    params.push(filters.fromDate);
  }
  if (filters.toDate) {
    where += ` AND initiated_at <= $${paramIdx++}`;
    params.push(filters.toDate);
  }

  params.push(filters.limit || 100, filters.offset || 0);

  const result = await query(
    `SELECT t.*, l.lane_number, u.username as operator_name
     FROM transactions t
     LEFT JOIN lanes l ON t.lane_id = l.id
     LEFT JOIN users u ON t.operator_id = u.id
     ${where}
     ORDER BY t.initiated_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    params
  );

  return result.rows;
}

export async function getDailySummary(laneId, date = new Date()) {
  const dateStr = date.toISOString().split('T')[0];
  const result = await query(
    `SELECT
       COUNT(*) as total_transactions,
       COALESCE(SUM(fee), 0) as total_revenue,
       COUNT(*) FILTER (WHERE payment_mode = 'CASH') as cash_count,
       COALESCE(SUM(fee) FILTER (WHERE payment_mode = 'CASH'), 0) as cash_revenue,
       COUNT(*) FILTER (WHERE payment_mode = 'QR') as qr_count,
       COALESCE(SUM(fee) FILTER (WHERE payment_mode = 'QR'), 0) as qr_revenue,
       COUNT(*) FILTER (WHERE payment_mode = 'FASTAG') as fastag_count,
       COALESCE(SUM(fee) FILTER (WHERE payment_mode = 'FASTAG'), 0) as fastag_revenue,
       COUNT(*) FILTER (WHERE status = 'EXCEPTION') as exceptions
     FROM transactions
     WHERE lane_id = $1 AND DATE(initiated_at) = $2`,
    [laneId, dateStr]
  );

  return result.rows[0];
}