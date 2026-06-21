const express = require('express');
const router = express.Router();
const moment = require('moment');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { pool } = require('../config/database');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

const getAttendanceData = async (from, to, employee_id = null) => {
  let sql = `SELECT a.*, e.first_name, e.last_name, e.department, e.designation
    FROM attendance a JOIN employees e ON a.employee_id = e.employee_id
    WHERE a.date BETWEEN ? AND ?`;
  const params = [from, to];
  if (employee_id) { sql += ` AND a.employee_id = ?`; params.push(employee_id); }
  sql += ` ORDER BY a.date ASC, e.first_name ASC`;
  const [rows] = await pool.query(sql, params);
  return rows;
};

const fmtMins = (mins) => {
  if (!mins) return '0h 0m';
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

// ── GET /api/reports/daily (admin) ───────────────────────────────────────────
router.get('/daily', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const date = req.query.date || moment().format('YYYY-MM-DD');
    const data = await getAttendanceData(date, date);
    const [breakData] = await pool.query(
      `SELECT bl.*, e.first_name, e.last_name FROM break_logs bl
       JOIN attendance a ON bl.attendance_id = a.id JOIN employees e ON bl.employee_id = e.employee_id
       WHERE a.date = ? ORDER BY bl.break_start`, [date]
    );
    res.json({ success: true, data, breaks: breakData, date });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

  // ── GET /api/reports/monthly (admin) ─────────────────────────────────────────
router.get('/monthly', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = month || moment().month() + 1;
    const y = year || moment().year();
    const from = moment(`${y}-${String(m).padStart(2, '0')}-01`).startOf('month').format('YYYY-MM-DD');
    const to = moment(`${y}-${String(m).padStart(2, '0')}-01`).endOf('month').format('YYYY-MM-DD');
    const data = await getAttendanceData(from, to);

    // Build summary manually (GROUP BY equivalent) — avoids complex SQL parsing
    const summaryMap = {};
    for (const row of data) {
      if (!summaryMap[row.employee_id]) {
        summaryMap[row.employee_id] = {
          employee_id: row.employee_id,
          first_name: row.first_name,
          last_name: row.last_name,
          department: row.department || '-',
          days_present: 0,
          total_working_minutes: 0,
          total_break_minutes: 0,
        };
      }
      const s = summaryMap[row.employee_id];
      s.days_present++;
      s.total_working_minutes += row.total_working_minutes || 0;
      s.total_break_minutes   += row.total_break_minutes   || 0;
    }
    const summary = Object.values(summaryMap).map(s => ({
      ...s,
      total_hours:        Math.round((s.total_working_minutes / 60) * 100) / 100,
      avg_hours_per_day:  s.days_present > 0
        ? Math.round((s.total_working_minutes / 60 / s.days_present) * 100) / 100
        : 0,
    })).sort((a, b) => a.first_name.localeCompare(b.first_name));

    res.json({ success: true, data, summary, from, to });
  } catch (error) {
    console.error('Monthly report error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/reports/weekly (admin) ──────────────────────────────────────────
router.get('/weekly', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { week_start } = req.query;
    const from = week_start ? moment(week_start).startOf('week').format('YYYY-MM-DD') : moment().startOf('week').format('YYYY-MM-DD');
    const to = moment(from).endOf('week').format('YYYY-MM-DD');
    const data = await getAttendanceData(from, to);
    res.json({ success: true, data, from, to });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/reports/export/excel ─────────────────────────────────────────────
// Works for both admin and employee.
// Employees can only export their own data (employee_id is forced from JWT).
// Admins can pass ?employee_id= to filter, or omit for all employees.
router.get('/export/excel', authenticate, async (req, res) => {
  try {
    const { from, to } = req.query;
    const startDate = from || moment().startOf('month').format('YYYY-MM-DD');
    const endDate = to || moment().format('YYYY-MM-DD');

    // Force employee_id for non-admin users
    const empId = req.user.role === 'admin'
      ? (req.query.employee_id || null)
      : req.user.employee_id;

    const data = await getAttendanceData(startDate, endDate, empId);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AttendTrack';
    const sheet = workbook.addWorksheet('Attendance Report', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    // Title row
    sheet.mergeCells('A1:J1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Employee Attendance Report';
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 35;

    // Subtitle
    sheet.mergeCells('A2:J2');
    const sub = sheet.getCell('A2');
    sub.value = `Period: ${startDate} to ${endDate}  |  Generated: ${moment().format('DD/MM/YYYY HH:mm')}`;
    sub.alignment = { horizontal: 'center' };

    // Headers
    const colDefs = [
      { header: 'Employee ID', width: 14 },
      { header: 'Name',        width: 22 },
      { header: 'Department',  width: 18 },
      { header: 'Date',        width: 14 },
      { header: 'Login',       width: 18 },
      { header: 'Logout',      width: 18 },
      { header: 'Working',     width: 12 },
      { header: 'Break',       width: 12 },
      { header: 'Status',      width: 12 },
      { header: 'Corrected',   width: 10 },
    ];
    const hRow = sheet.getRow(4);
    hRow.height = 25;
    colDefs.forEach((c, i) => {
      const cell = hRow.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      sheet.getColumn(i + 1).width = c.width;
    });

    // Data rows
    data.forEach((row, idx) => {
      const dRow = sheet.getRow(idx + 5);
      [
        row.employee_id,
        `${row.first_name} ${row.last_name}`,
        row.department || '-',
        moment(row.date).format('DD/MM/YYYY'),
        row.login_time ? moment(row.login_time).format('DD/MM/YYYY HH:mm') : '-',
        row.logout_time ? moment(row.logout_time).format('DD/MM/YYYY HH:mm') : '-',
        fmtMins(row.total_working_minutes),
        fmtMins(row.total_break_minutes),
        row.status,
        row.is_corrected ? 'Yes' : 'No',
      ].forEach((val, i) => {
        const cell = dRow.getCell(i + 1);
        cell.value = val;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        if (idx % 2 === 0)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_${startDate}_${endDate}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// ── GET /api/reports/export/pdf ───────────────────────────────────────────────
// Works for both admin and employee (same logic as excel above).
router.get('/export/pdf', authenticate, async (req, res) => {
  try {
    const { from, to } = req.query;
    const startDate = from || moment().startOf('month').format('YYYY-MM-DD');
    const endDate = to || moment().format('YYYY-MM-DD');

    const empId = req.user.role === 'admin'
      ? (req.query.employee_id || null)
      : req.user.employee_id;

    const data = await getAttendanceData(startDate, endDate, empId);

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_${startDate}_${endDate}.pdf`);
    doc.pipe(res);

    // Header band
    doc.rect(0, 0, doc.page.width, 80).fill('#1E3A5F');
    doc.fillColor('white').fontSize(22).font('Helvetica-Bold')
      .text('Employee Attendance Report', 40, 20);
    doc.fontSize(11).font('Helvetica')
      .text(`Period: ${startDate} to ${endDate}  |  Generated: ${moment().format('DD/MM/YYYY HH:mm')}`, 40, 50);
    doc.fillColor('black').moveDown(3);

    const colWidths = [70, 110, 90, 65, 90, 90, 65, 65, 70];
    const headers  = ['Emp ID', 'Name', 'Department', 'Date', 'Login', 'Logout', 'Working', 'Break', 'Status'];
    const headerY  = 100;
    let x = 40;

    doc.rect(40, headerY, doc.page.width - 80, 20).fill('#2563EB');
    headers.forEach((h, i) => {
      doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
        .text(h, x + 2, headerY + 5, { width: colWidths[i] - 4, align: 'center' });
      x += colWidths[i];
    });

    let y = headerY + 22;
    data.forEach((row, idx) => {
      if (y > doc.page.height - 60) { doc.addPage({ layout: 'landscape' }); y = 40; }
      doc.rect(40, y, doc.page.width - 80, 18).fill(idx % 2 === 0 ? '#F0F9FF' : '#FFFFFF');
      const cells = [
        row.employee_id,
        `${row.first_name} ${row.last_name}`,
        row.department || '-',
        moment(row.date).format('DD/MM/YY'),
        row.login_time  ? moment(row.login_time).format('HH:mm')  : '-',
        row.logout_time ? moment(row.logout_time).format('HH:mm') : '-',
        fmtMins(row.total_working_minutes),
        fmtMins(row.total_break_minutes),
        row.status,
      ];
      x = 40;
      cells.forEach((val, i) => {
        doc.fillColor('#1F2937').fontSize(8).font('Helvetica')
          .text(String(val), x + 2, y + 4, { width: colWidths[i] - 4, align: 'center' });
        x += colWidths[i];
      });
      y += 19;
    });

    // Footer
    doc.rect(0, doc.page.height - 30, doc.page.width, 30).fill('#1E3A5F');
    doc.fillColor('white').fontSize(9)
      .text(`Total Records: ${data.length}  |  AttendTrack — Employee Attendance System`, 40, doc.page.height - 20);
    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// ── GET /api/reports/audit-logs (admin only) ──────────────────────────────────
router.get('/audit-logs', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      `SELECT al.*, e.first_name || ' ' || e.last_name as actor_name
       FROM audit_logs al LEFT JOIN employees e ON al.action_by = e.employee_id
       ORDER BY al.created_at DESC LIMIT ? OFFSET ?`,
      [parseInt(limit), parseInt(offset)]
    );
    const [countRes] = await pool.query('SELECT COUNT(*) as total FROM audit_logs');
    res.json({
      success: true,
      data: rows,
      pagination: { total: countRes[0]?.total || 0, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
