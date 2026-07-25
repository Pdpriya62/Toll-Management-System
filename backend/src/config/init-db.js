import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tollease',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'devpass',
});

const schema = `
-- Users table (operators & supervisors)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('operator', 'supervisor')),
    full_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Plazas (single plaza for MVP)
CREATE TABLE IF NOT EXISTS plazas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    location VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Lanes (single lane for MVP)
CREATE TABLE IF NOT EXISTS lanes (
    id SERIAL PRIMARY KEY,
    plaza_id INTEGER REFERENCES plazas(id),
    lane_number INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'closed' CHECK (status IN ('open', 'closed', 'maintenance')),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (plaza_id, lane_number)
);

-- Rate cards (vehicle class -> fee)
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

-- Transactions (core state machine)
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    plaza_id INTEGER REFERENCES plazas(id),
    lane_id INTEGER REFERENCES lanes(id),
    vehicle_class VARCHAR(30) NOT NULL,
    vehicle_number VARCHAR(30),
    entry_time TIMESTAMP DEFAULT NOW(),
    exit_time TIMESTAMP,
    fee DECIMAL(10,2),
    payment_mode VARCHAR(20) CHECK (payment_mode IN ('cash', 'qr', 'tag', 'exempt')),
    status VARCHAR(20) DEFAULT 'initiated' CHECK (status IN ('initiated', 'validated', 'authorized', 'completed', 'settled', 'exception')),
    operator_id INTEGER REFERENCES users(id),
    evidence_ref VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Shift management
CREATE TABLE IF NOT EXISTS shifts (
    id SERIAL PRIMARY KEY,
    plaza_id INTEGER REFERENCES plazas(id),
    operator_id INTEGER REFERENCES users(id),
    lane_id INTEGER REFERENCES lanes(id),
    declared_cash DECIMAL(12,2) DEFAULT 0,
    system_cash DECIMAL(12,2) DEFAULT 0,
    declared_qr DECIMAL(12,2) DEFAULT 0,
    system_qr DECIMAL(12,2) DEFAULT 0,
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'reconciled'))
);

-- Audit log (immutable)
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(30) NOT NULL,
    entity_id INTEGER NOT NULL,
    action VARCHAR(30) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_lane_time ON transactions(lane_id, entry_time);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_shifts_operator ON shifts(operator_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
`;

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(schema);
    console.log('Database schema initialized successfully');

    // Insert default plaza and lane
    await client.query(`
      INSERT INTO plazas (name, code, location)
      VALUES ('Main Plaza', 'MP01', 'Highway KM 42')
      ON CONFLICT (code) DO NOTHING
    `);

    await client.query(`
      INSERT INTO lanes (plaza_id, lane_number, status)
      VALUES (1, 1, 'open')
      ON CONFLICT (plaza_id, lane_number) DO NOTHING
    `);

    // Insert default rate card
    await client.query(`
      INSERT INTO rate_cards (plaza_id, vehicle_class, fee)
      VALUES 
        (1, 'car', 50.00),
        (1, 'bus', 150.00),
        (1, 'truck', 200.00),
        (1, 'motorcycle', 30.00)
      ON CONFLICT (plaza_id, vehicle_class, effective_from) DO NOTHING
    `);

    // Create default supervisor user (password: admin123)
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO users (username, password_hash, role, full_name)
      VALUES ('supervisor', $1, 'supervisor', 'System Supervisor')
      ON CONFLICT (username) DO NOTHING
    `, [hash]);

    // Create default operator user (password: op123)
    const opHash = await bcrypt.hash('op123', 10);
    await client.query(`
      INSERT INTO users (username, password_hash, role, full_name)
      VALUES ('operator', $1, 'operator', 'Lane Operator')
      ON CONFLICT (username) DO NOTHING
    `, [opHash]);

    console.log('Default data seeded');
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

initDb();