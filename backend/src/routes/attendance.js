const express = require('express');
const router = express.Router();
const moment = require('moment');
const { pool } = require('../config/database');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const { createAuditLog } = require('../middleware/auditLog');

// POST /api/attendance/clock-in
router.post('/clock-in', authenticate, async (req, res) => {
  try {
    const empId = req.user.employee_id;
    const today = moment().format('YYYY-MM-DD');
    const now = moment().format('YYYY-MM-DD HH:mm:ss');

    const [existing] = await pool.query(
      'SELECT id, logout_time FROM attendance WHERE employee_id = ? AND date = ?',
      [empId, today]
    );

    if (existing.length && !existing[0].logout_time) {
      const [openBreak] = await pool.query(
        'SELECT id FROM break_logs WHERE attendance_id = ? AND break_end IS NULL',
        [existing[0].id]
      );
      if (openBreak.length) {
        const mins = moment(now).diff(moment().subtract(0), 'minutes');
        await pool.query(
          `UPDATE break_logs SET break_end = ?, break_duration_minutes = CAST((julianday(?) - julianday(break_start)) * 1440 AS INTEGER) WHERE id = ?`,
          [now, now, openBreak[0].id]
        );
        const [breaks] = await pool.query(
          'SELECT COALESCE(SUM(break_duration_minutes),0) as total FROM break_logs WHERE attendance_id = ?',
          [existing[0].id]
        );
        await pool.query('UPDATE attendance SET total_break_minutes = ? WHERE id = ?', [breaks[0].total, existing[0].id]);
        return res.json({ success: true, message: 'Break ended, resumed working', status: 'working' });
      }
      return res.status(400).json({ success: false, message: 'Already clocked in and working' });
    }

    if (existing.length && existing[0].logout_time) {
      return res.status(400).json({ success: false, message: 'Already clocked out for today' });
    }

    await pool.query(
      'INSERT INTO attendance (employee_id, date, login_time, status) VALUES (?, ?, ?, ?)',
      [empId, today, now, 'present']
    );

    res.json({ success: true, message: 'Clocked in successfully', login_time: now, status: 'working' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/attendance/clock-out
router.post('/clock-out', authenticate, async (req, res) => {
  try {
    const empId = req.user.employee_id;
    const today = moment().format('YYYY-MM-DD');
    const now = moment().format('YYYY-MM-DD HH:mm:ss');

    const [attendance] = await pool.query(
      'SELECT id, login_time, logout_time FROM attendance WHERE employee_id = ? AND date = ?',
      [empId, today]
    );

    if (!attendance.length) return res.status(400).json({ success: false, message: 'Not clocked in today' });
    if (attendance[0].logout_time) return res.status(400).json({ success: false, message: 'Already clocked out' });

    const [openBreaks] = await pool.query(
      'SELECT id FROM break_logs WHERE attendance_id = ? AND break_end IS NULL',
      [attendance[0].id]
    );
    for (const b of openBreaks) {
      await pool.query(
        `UPDATE break_logs SET break_end = ?, break_duration_minutes = CAST((julianday(?) - julianday(break_start)) * 1440 AS INTEGER) WHERE id = ?`,
        [now, now, b.id]
      );
    }

    const [breaks] = await pool.query(
      'SELECT COALESCE(SUM(break_duration_minutes),0) as total FROM break_logs WHERE attendance_id = ?',
      [attendance[0].id]
    );
    const totalBreak = breaks[0].total || 0;
    const totalMinutes = moment(now).diff(moment(attendance[0].login_time), 'minutes');
    const workingMinutes = Math.max(0, totalMinutes - totalBreak);

    await pool.query(
      `UPDATE attendance SET logout_time = ?, total_break_minutes = ?, total_working_minutes = ? WHERE id = ?`,
      [now, totalBreak, workingMinutes, attendance[0].id]
    );

    res.json({ success: true, message: 'Clocked out', logout_time: now, total_working_minutes: workingMinutes, total_break_minutes: totalBreak });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/attendance/break-start
router.post('/break-start', authenticate, async (req, res) => {
  try {
    const { break_reason } = req.body;
    const valid = ['lunch_break', 'tea_break', 'meeting', 'personal_work'];
    if (!break_reason || !valid.includes(break_reason))
      return res.status(400).json({ success: false, message: 'Valid break reason required' });

    const empId = req.user.employee_id;
    const today = moment().format('YYYY-MM-DD');
    const now = moment().format('YYYY-MM-DD HH:mm:ss');

    const [attendance] = await pool.query(
      'SELECT id, logout_time FROM attendance WHERE employee_id = ? AND date = ?', [empId, today]
    );
    if (!attendance.length || attendance[0].logout_time)
      return res.status(400).json({ success: false, message: 'Not currently working' });

    const [openBreak] = await pool.query(
      'SELECT id FROM break_logs WHERE attendance_id = ? AND break_end IS NULL', [attendance[0].id]
    );
    if (openBreak.length) return res.status(400).json({ success: false, message: 'Already on break' });

    await pool.query(
      'INSERT INTO break_logs (attendance_id, employee_id, break_start, break_reason) VALUES (?, ?, ?, ?)',
      [attendance[0].id, empId, now, break_reason]
    );

    res.json({ success: true, message: 'Break started', break_start: now, break_reason, status: 'on_break' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/attendance/status
router.get('/status', authenticate, async (req, res) => {
  try {
    const empId = req.user.employee_id;
    const today = moment().format('YYYY-MM-DD');

    const [attendance] = await pool.query('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [empId, today]);
    if (!attendance.length) return res.json({ success: true, status: 'not_started', data: null });

    const att = attendance[0];
    let status = 'clocked_out';
    let currentBreak = null;

    if (att.login_time && !att.logout_time) {
      const [openBreak] = await pool.query(
        'SELECT * FROM break_logs WHERE attendance_id = ? AND break_end IS NULL', [att.id]
      );
      status = openBreak.length ? 'on_break' : 'working';
      currentBreak = openBreak[0] || null;
    }

    const [breaks] = await pool.query('SELECT * FROM break_logs WHERE attendance_id = ? ORDER BY break_start', [att.id]);
    res.json({ success: true, status, data: att, breaks, currentBreak });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/attendance/my-history
router.get('/my-history', authenticate, async (req, res) => {
  try {
    const { from, to, page = 1, limit = 20 } = req.query;
    const empId = req.user.employee_id;
    const offset = (page - 1) * limit;

    let sql = `SELECT * FROM attendance WHERE employee_id = ?`;
    const params = [empId];
    if (from) { sql += ` AND date >= ?`; params.push(from); }
    if (to) { sql += ` AND date <= ?`; params.push(to); }
    sql += ` ORDER BY date DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.query(sql, params);
    const [countRes] = await pool.query('SELECT COUNT(*) as total FROM attendance WHERE employee_id = ?', [empId]);
    const total = countRes[0]?.total || 0;

    res.json({ success: true, data: rows, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/attendance/all (admin)
router.get('/all', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { employee_id, from, to, status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `SELECT a.*, e.first_name, e.last_name, e.department, e.designation FROM attendance a JOIN employees e ON a.employee_id = e.employee_id WHERE 1=1`;
    const params = [];
    if (employee_id) { sql += ` AND a.employee_id = ?`; params.push(employee_id); }
    if (from) { sql += ` AND a.date >= ?`; params.push(from); }
    if (to) { sql += ` AND a.date <= ?`; params.push(to); }
    if (status) { sql += ` AND a.status = ?`; params.push(status); }
    sql += ` ORDER BY a.date DESC, e.first_name ASC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.query(sql, params);
    let countSql = `SELECT COUNT(*) as total FROM attendance a JOIN employees e ON a.employee_id = e.employee_id WHERE 1=1`;
    const countParams = [];
    if (employee_id) { countSql += ` AND a.employee_id = ?`; countParams.push(employee_id); }
    if (from) { countSql += ` AND a.date >= ?`; countParams.push(from); }
    if (to) { countSql += ` AND a.date <= ?`; countParams.push(to); }
    if (status) { countSql += ` AND a.status = ?`; countParams.push(status); }
    const [countRes] = await pool.query(countSql, countParams);

    res.json({ success: true, data: rows, pagination: { total: countRes[0]?.total || 0, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/attendance/:id/correct (admin)
router.put('/:id/correct', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { login_time, logout_time, status, notes } = req.body;
    const attId = req.params.id;
    const [existing] = await pool.query('SELECT * FROM attendance WHERE id = ?', [attId]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Not found' });

    let workingMinutes = existing[0].total_working_minutes;
    if (login_time && logout_time) {
      const totalMins = moment(logout_time).diff(moment(login_time), 'minutes');
      workingMinutes = Math.max(0, totalMins - (existing[0].total_break_minutes || 0));
    }

    await pool.query(
      `UPDATE attendance SET login_time=?,logout_time=?,status=?,notes=?,total_working_minutes=?,is_corrected=1,corrected_by=?,corrected_at=datetime('now') WHERE id=?`,
      [login_time || existing[0].login_time, logout_time || existing[0].logout_time,
       status || existing[0].status, notes || existing[0].notes, workingMinutes, req.user.employee_id, attId]
    );

    await createAuditLog(req.user.employee_id, 'attendance_correction', 'attendance', String(attId), `Corrected attendance ID ${attId}`, req.ip);
    res.json({ success: true, message: 'Attendance corrected' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/attendance/dashboard/stats (admin)
router.get('/dashboard/stats', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD');

    const [totalEmp] = await pool.query('SELECT COUNT(*) as count FROM employees WHERE is_active = 1');
    const [present] = await pool.query('SELECT COUNT(DISTINCT employee_id) as count FROM attendance WHERE date = ? AND login_time IS NOT NULL', [today]);
    const [working] = await pool.query(
      `SELECT COUNT(*) as count FROM attendance WHERE date = ? AND login_time IS NOT NULL AND logout_time IS NULL
       AND id NOT IN (SELECT attendance_id FROM break_logs WHERE break_end IS NULL)`, [today]
    );
    const [onBreak] = await pool.query(
      `SELECT COUNT(*) as count FROM break_logs bl JOIN attendance a ON bl.attendance_id = a.id WHERE a.date = ? AND bl.break_end IS NULL`, [today]
    );
    const [workHours] = await pool.query('SELECT COALESCE(SUM(total_working_minutes),0) as total FROM attendance WHERE date = ?', [today]);

    const absent = Math.max(0, (totalEmp[0]?.count || 0) - (present[0]?.count || 0));
    res.json({
      success: true,
      data: {
        total_employees: totalEmp[0]?.count || 0,
        present_today: present[0]?.count || 0,
        absent_today: absent,
        working_now: working[0]?.count || 0,
        on_break: onBreak[0]?.count || 0,
        total_working_hours_today: Math.round(((workHours[0]?.total || 0) / 60) * 10) / 10,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/attendance/breaks/:attendanceId
router.get('/breaks/:attendanceId', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM break_logs WHERE attendance_id = ? ORDER BY break_start', [req.params.attendanceId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
