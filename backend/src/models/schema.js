import { pool, query } from '../config/db.js';

export async function initSchema() {
  const schema = `
    CREATE TABLE IF NOT EXISTS plazas (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(20) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS lanes (
      id SERIAL PRIMARY KEY,
      plaza_id INTEGER REFERENCES plazas(id),
      lane_number INTEGER NOT NULL,
      status VARCHAR(20) DEFAULT 'OPEN',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (plaza_id, lane_number)
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('operator', 'supervisor')),
      plaza_id INTEGER REFERENCES plazas(id),
      lane_id INTEGER REFERENCES lanes(id),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS rate_cards (
      id SERIAL PRIMARY KEY,
      plaza_id INTEGER REFERENCES plazas(id),
      vehicle_class VARCHAR(30) NOT NULL,
      fee DECIMAL(10,2) NOT NULL,
      effective_from DATE DEFAULT CURRENT_DATE,
      effective_to DATE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (plaza_id, vehicle_class, effective_from)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      plaza_id INTEGER REFERENCES plazas(id),
      lane_id INTEGER REFERENCES lanes(id),
      vehicle_class VARCHAR(30) NOT NULL,
      vehicle_number VARCHAR(20),
      fee DECIMAL(10,2) NOT NULL,
      payment_mode VARCHAR(20) DEFAULT 'CASH' CHECK (payment_mode IN ('CASH', 'QR', 'FASTAG', 'EXEMPT')),
      status VARCHAR(30) NOT NULL DEFAULT 'INITIATED' CHECK (status IN ('INITIATED', 'VALIDATED', 'AUTHORIZED', 'COMPLETED', 'SETTLED', 'EXCEPTION', 'VOIDED')),
      evidence_ref VARCHAR(100),
      operator_id INTEGER REFERENCES users(id),
      supervisor_id INTEGER REFERENCES users(id),
      initiated_at TIMESTAMP DEFAULT NOW(),
      validated_at TIMESTAMP,
      authorized_at TIMESTAMP,
      completed_at TIMESTAMP,
      settled_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id BIGSERIAL PRIMARY KEY,
      table_name VARCHAR(50) NOT NULL,
      record_id BIGINT NOT NULL,
      action VARCHAR(20) NOT NULL,
      old_data JSONB,
      new_data JSONB,
      user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS blacklist (
      id SERIAL PRIMARY KEY,
      vehicle_number VARCHAR(20) UNIQUE NOT NULL,
      reason TEXT,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS exempt_vehicles (
      id SERIAL PRIMARY KEY,
      vehicle_number VARCHAR(20) UNIQUE NOT NULL,
      reason TEXT,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_lane_time ON transactions(lane_id, initiated_at);
    CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
    CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id);
  `;

  await query(schema);
  console.log('Database schema initialized');
}

export async function seedData() {
  const plazaRes = await query(`INSERT INTO plazas (name, code) VALUES ('Main Plaza', 'MP01') ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id`);
  const plazaId = plazaRes.rows[0].id;

  await query(`INSERT INTO lanes (plaza_id, lane_number) VALUES ($1, 1) ON CONFLICT (plaza_id, lane_number) DO NOTHING`, [plazaId]);

  const rateClasses = [
    { vehicle_class: 'CAR', fee: 50.00 },
    { vehicle_class: 'LCV', fee: 75.00 },
    { vehicle_class: 'TRUCK', fee: 120.00 },
    { vehicle_class: 'BUS', fee: 150.00 },
    { vehicle_class: 'TWO_WHEELER', fee: 25.00 },
  ];

  for (const rc of rateClasses) {
    await query(
      `INSERT INTO rate_cards (plaza_id, vehicle_class, fee) VALUES ($1, $2, $3) ON CONFLICT (plaza_id, vehicle_class, effective_from) DO NOTHING`,
      [plazaId, rc.vehicle_class, rc.fee]
    );
  }

  console.log('Seed data inserted');
}