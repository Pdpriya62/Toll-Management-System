import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

process.env.JWT_SECRET ??= 'test-secret';

// Fake DB: two users, INSERT echoes back the new row.
const users = { 1: { id: 1, username: 'sup', role: 'supervisor' }, 2: { id: 2, username: 'op', role: 'operator' } };
mock.module('../src/config/db.js', {
  namedExports: {
    query: async (sql, params = []) => {
      if (sql.startsWith('INSERT')) return { rows: [{ id: 3, username: params[0], role: params[2] }] };
      if (sql.includes('WHERE id')) return { rows: users[params[0]] ? [users[params[0]]] : [] };
      return { rows: Object.values(users) };
    },
    getClient: async () => ({}),
  },
});

const { generateToken } = await import('../src/middleware/auth.js');
const { default: authRoutes } = await import('../src/routes/auth.js');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
const server = app.listen(0);
const base = `http://localhost:${server.address().port}/api/auth`;

const post = (path, body, user) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(user && { Authorization: `Bearer ${generateToken(user)}` }) },
    body: JSON.stringify(body),
  });

const newUser = { username: 'x', password: 'longenough', role: 'supervisor' };

test('public /register is gone', async () => {
  assert.equal((await post('/register', newUser)).status, 404);
});

test('creating users needs a token', async () => {
  assert.equal((await post('/users', newUser)).status, 401);
});

test('operator cannot create users', async () => {
  assert.equal((await post('/users', newUser, users[2])).status, 403);
});

test('supervisor can create users', async () => {
  assert.equal((await post('/users', newUser, users[1])).status, 201);
});

test('short password rejected', async () => {
  assert.equal((await post('/users', { ...newUser, password: 'short' }, users[1])).status, 400);
});

test.after(() => server.close());
