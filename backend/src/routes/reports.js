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
  return `${Math.floor(mins/60)}h ${mins%60}m`;
};

// GET /api/reports/daily
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

// GET /api/reports/monthly
router.get('/monthly', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = month || moment().month() + 1;
    const y = year || moment().year();
    const from = moment(`${y}-${String(m).padStart(2,'0')}-01`).startOf('month').format('YYYY-MM-DD');
    const to = moment(`${y}-${String(m).padStart(2,'0')}-01`).endOf('month').format('YYYY-MM-DD');
    const data = await getAttendanceData(from, to);

    const [summary] = await pool.query(
      `SELECT a.employee_id, e.first_name, e.last_name, e.department,
        COUNT(*) as days_present,
        ROUND(SUM(a.total_working_minutes) / 60.0, 2) as total_hours,
        ROUND(AVG(a.total_working_minutes) / 60.0, 2) as avg_hours_per_day,
        SUM(a.total_break_minutes) as total_break_minutes
       FROM attendance a JOIN employees e ON a.employee_id = e.employee_id
       WHERE a.date BETWEEN ? AND ?
       GROUP BY a.employee_id, e.first_name, e.last_name, e.department
       ORDER BY e.first_name`, [from, to]
    );
    res.json({ success: true, data, summary, from, to });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/reports/weekly
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

// GET /api/reports/export/excel
router.get('/export/excel', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { from, to, employee_id } = req.query;
    const startDate = from || moment().startOf('month').format('YYYY-MM-DD');
    const endDate = to || moment().format('YYYY-MM-DD');
    const data = await getAttendanceData(startDate, endDate, employee_id || null);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AttendTrack';
    const sheet = workbook.addWorksheet('Attendance Report', { pageSetup: { paperSize: 9, orientation: 'landscape' } });

    sheet.mergeCells('A1:J1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Employee Attendance Report';
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 35;

    sheet.mergeCells('A2:J2');
    const subTitle = sheet.getCell('A2');
    subTitle.value = `Period: ${startDate} to ${endDate}  |  Generated: ${moment().format('DD/MM/YYYY HH:mm')}`;
    subTitle.alignment = { horizontal: 'center' };

    const cols = [
      { header: 'Employee ID', key: 'emp_id', width: 14 },
      { header: 'Name', key: 'name', width: 22 },
      { header: 'Department', key: 'dept', width: 18 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Login', key: 'login', width: 18 },
      { header: 'Logout', key: 'logout', width: 18 },
      { header: 'Working', key: 'working', width: 12 },
      { header: 'Break', key: 'break', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Corrected', key: 'corrected', width: 10 },
    ];

    const hRow = sheet.getRow(4);
    cols.forEach((c, i) => {
      const cell = hRow.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
      sheet.getColumn(i + 1).width = c.width;
    });
    hRow.height = 25;

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
        cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
        if (idx % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_${startDate}_${endDate}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/reports/export/pdf
router.get('/export/pdf', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { from, to, employee_id } = req.query;
    const startDate = from || moment().startOf('month').format('YYYY-MM-DD');
    const endDate = to || moment().format('YYYY-MM-DD');
    const data = await getAttendanceData(startDate, endDate, employee_id || null);

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_${startDate}_${endDate}.pdf`);
    doc.pipe(res);

    doc.rect(0, 0, doc.page.width, 80).fill('#1E3A5F');
    doc.fillColor('white').fontSize(22).font('Helvetica-Bold').text('Employee Attendance Report', 40, 20);
    doc.fontSize(11).font('Helvetica').text(`Period: ${startDate} to ${endDate}  |  Generated: ${moment().format('DD/MM/YYYY HH:mm')}`, 40, 50);
    doc.fillColor('black').moveDown(3);

    const cols = [70, 110, 90, 65, 90, 90, 65, 65, 70];
    const headers = ['Emp ID', 'Name', 'Department', 'Date', 'Login', 'Logout', 'Working', 'Break', 'Status'];
    const headerY = 100;
    let x = 40;

    doc.rect(40, headerY, doc.page.width - 80, 20).fill('#2563EB');
    headers.forEach((h, i) => {
      doc.fillColor('white').fontSize(9).font('Helvetica-Bold').text(h, x + 2, headerY + 5, { width: cols[i] - 4, align: 'center' });
      x += cols[i];
    });

    let y = headerY + 22;
    data.forEach((row, idx) => {
      if (y > doc.page.height - 60) { doc.addPage({ layout: 'landscape' }); y = 40; }
      doc.rect(40, y, doc.page.width - 80, 18).fill(idx % 2 === 0 ? '#F0F9FF' : '#FFFFFF');
      const rowData = [
        row.employee_id,
        `${row.first_name} ${row.last_name}`,
        row.department || '-',
        moment(row.date).format('DD/MM/YY'),
        row.login_time ? moment(row.login_time).format('HH:mm') : '-',
        row.logout_time ? moment(row.logout_time).format('HH:mm') : '-',
        fmtMins(row.total_working_minutes),
        fmtMins(row.total_break_minutes),
        row.status,
      ];
      x = 40;
      rowData.forEach((val, i) => {
        doc.fillColor('#1F2937').fontSize(8).font('Helvetica').text(String(val), x + 2, y + 4, { width: cols[i] - 4, align: 'center' });
        x += cols[i];
      });
      y += 19;
    });

    doc.rect(0, doc.page.height - 30, doc.page.width, 30).fill('#1E3A5F');
    doc.fillColor('white').fontSize(9).text(`Total Records: ${data.length}  |  AttendTrack - Employee Attendance System`, 40, doc.page.height - 20);
    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/reports/audit-logs
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
    res.json({ success: true, data: rows, pagination: { total: countRes[0]?.total || 0, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
