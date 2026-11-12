import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { generateToken, authMiddleware, roleMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const result = await query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, fullName: user.full_name }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Only supervisors create accounts; there is no public sign-up.
router.get('/users', authMiddleware, roleMiddleware('supervisor'), async (req, res) => {
  try {
    const result = await query('SELECT id, username, role, full_name, created_at FROM users ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

router.post('/users', authMiddleware, roleMiddleware('supervisor'), async (req, res) => {
  try {
    const { username, password, role, fullName } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Username, password, role required' });
    }
    if (!['operator', 'supervisor'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (username, password_hash, role, full_name) VALUES ($1, $2, $3, $4) RETURNING id, username, role, full_name',
      [username, hash, role, fullName]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!(await bcrypt.compare(currentPassword, result.rows[0].password_hash))) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(newPassword, 10), req.user.id]);
    res.json({ message: 'Password changed' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });

    const token = auth.substring(7);
    const { verifyToken } = await import('../middleware/auth.js');
    const decoded = verifyToken(token);

    const result = await query('SELECT id, username, role, full_name FROM users WHERE id = $1', [decoded.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;