const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { createAuditLog } = require('../middleware/auditLog');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { employee_id, password } = req.body;
    if (!employee_id || !password)
      return res.status(400).json({ success: false, message: 'Employee ID and password required' });

    const [users] = await pool.query(
      `SELECT u.*, e.first_name, e.last_name, e.email, e.department, e.designation, e.profile_image
       FROM users u JOIN employees e ON u.employee_id = e.employee_id
       WHERE u.employee_id = ? AND u.is_active = 1 AND e.is_active = 1`,
      [employee_id.toUpperCase()]
    );

    if (!users.length) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign(
      { employee_id: user.employee_id, role: user.role },
      process.env.JWT_SECRET || 'default_secret_key_change_in_production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    await createAuditLog(user.employee_id, 'login', 'users', user.employee_id, 'Logged in', req.ip);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        employee_id: user.employee_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        department: user.department,
        designation: user.designation,
        role: user.role,
        profile_image: user.profile_image,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  await createAuditLog(req.user.employee_id, 'logout', 'users', req.user.employee_id, 'Logged out', req.ip);
  res.json({ success: true, message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({
    success: true,
    user: {
      employee_id: req.user.employee_id,
      first_name: req.user.first_name,
      last_name: req.user.last_name,
      email: req.user.email,
      department: req.user.department,
      designation: req.user.designation,
      role: req.user.role,
      profile_image: req.user.profile_image,
    },
  });
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return res.status(400).json({ success: false, message: 'Both passwords required' });
    if (new_password.length < 6)
      return res.status(400).json({ success: false, message: 'Min 6 characters' });

    const [users] = await pool.query('SELECT password_hash FROM users WHERE employee_id = ?', [req.user.employee_id]);
    const valid = await bcrypt.compare(current_password, users[0].password_hash);
    if (!valid) return res.status(400).json({ success: false, message: 'Current password incorrect' });

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE employee_id = ?', [hash, req.user.employee_id]);
    await createAuditLog(req.user.employee_id, 'password_reset', 'users', req.user.employee_id, 'Password changed', req.ip);
    res.json({ success: true, message: 'Password changed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
