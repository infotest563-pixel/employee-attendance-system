const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const { createAuditLog } = require('../middleware/auditLog');

// GET /api/employees
router.get('/', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { search, department, is_active } = req.query;
    let sql = `SELECT e.*, u.role, u.is_active as user_active FROM employees e LEFT JOIN users u ON e.employee_id = u.employee_id WHERE 1=1`;
    const params = [];
    if (search) {
      sql += ` AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.employee_id LIKE ? OR e.email LIKE ?)`;
      const s = `%${search}%`; params.push(s, s, s, s);
    }
    if (department) { sql += ` AND e.department = ?`; params.push(department); }
    if (is_active !== undefined) { sql += ` AND e.is_active = ?`; params.push(is_active); }
    sql += ` ORDER BY e.created_at DESC`;
    const [employees] = await pool.query(sql, params);
    res.json({ success: true, data: employees });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/employees/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const empId = req.params.id.toUpperCase();
    if (req.user.role !== 'admin' && req.user.employee_id !== empId)
      return res.status(403).json({ success: false, message: 'Access denied' });

    const [rows] = await pool.query(
      `SELECT e.*, u.role FROM employees e LEFT JOIN users u ON e.employee_id = u.employee_id WHERE e.employee_id = ?`, [empId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/employees
router.post('/', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { employee_id, first_name, last_name, email, phone, department, designation, date_of_joining, password } = req.body;
    if (!employee_id || !first_name || !last_name || !email || !password)
      return res.status(400).json({ success: false, message: 'Required fields missing' });

    const empId = employee_id.toUpperCase();
    const [existing] = await pool.query('SELECT id FROM employees WHERE employee_id = ? OR email = ?', [empId, email]);
    if (existing.length) return res.status(409).json({ success: false, message: 'Employee ID or email already exists' });

    await pool.query(
      `INSERT INTO employees (employee_id,first_name,last_name,email,phone,department,designation,date_of_joining) VALUES (?,?,?,?,?,?,?,?)`,
      [empId, first_name, last_name, email, phone || null, department || null, designation || null, date_of_joining || null]
    );
    const hash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (employee_id,password_hash,role) VALUES (?,?,?)', [empId, hash, 'employee']);

    await createAuditLog(req.user.employee_id, 'create', 'employees', empId, `Created employee ${empId}`, req.ip);
    res.status(201).json({ success: true, message: 'Employee created', employee_id: empId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/employees/:id
router.put('/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const empId = req.params.id.toUpperCase();
    const { first_name, last_name, email, phone, department, designation, date_of_joining, is_active } = req.body;
    const [existing] = await pool.query('SELECT id FROM employees WHERE employee_id = ?', [empId]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Not found' });

    await pool.query(
      `UPDATE employees SET first_name=?,last_name=?,email=?,phone=?,department=?,designation=?,date_of_joining=?,is_active=?,updated_at=datetime('now') WHERE employee_id=?`,
      [first_name, last_name, email, phone || null, department || null, designation || null, date_of_joining || null, is_active ?? 1, empId]
    );
    if (is_active === 0) await pool.query(`UPDATE users SET is_active=0 WHERE employee_id=?`, [empId]);
    else if (is_active === 1) await pool.query(`UPDATE users SET is_active=1 WHERE employee_id=?`, [empId]);

    await createAuditLog(req.user.employee_id, 'update', 'employees', empId, `Updated ${empId}`, req.ip);
    res.json({ success: true, message: 'Updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/employees/:id
router.delete('/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const empId = req.params.id.toUpperCase();
    if (empId === req.user.employee_id)
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    await pool.query(`UPDATE employees SET is_active=0 WHERE employee_id=?`, [empId]);
    await pool.query(`UPDATE users SET is_active=0 WHERE employee_id=?`, [empId]);
    await createAuditLog(req.user.employee_id, 'delete', 'employees', empId, `Deactivated ${empId}`, req.ip);
    res.json({ success: true, message: 'Deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/employees/:id/reset-password
router.post('/:id/reset-password', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const empId = req.params.id.toUpperCase();
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6)
      return res.status(400).json({ success: false, message: 'Min 6 characters' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query(`UPDATE users SET password_hash=? WHERE employee_id=?`, [hash, empId]);
    await createAuditLog(req.user.employee_id, 'password_reset', 'users', empId, `Password reset for ${empId}`, req.ip);
    res.json({ success: true, message: 'Password reset' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/employees/meta/departments
router.get('/meta/departments', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT DISTINCT department FROM employees WHERE department IS NOT NULL ORDER BY department');
    res.json({ success: true, data: rows.map(r => r.department) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
