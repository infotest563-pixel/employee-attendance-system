// Local development — SQLite (no install needed)
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'attendance.db');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let db;

const persist = () => {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
};

const queryRows = (sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    const rows = [];
    if (params.length > 0) stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  } catch (err) { console.error('Query error:', sql, err.message); throw err; }
};

const execute = (sql, params = []) => {
  try {
    db.run(sql, params);
    persist();
    return { changes: db.getRowsModified() };
  } catch (err) { console.error('Execute error:', sql, err.message); throw err; }
};

const pool = {
  query: async (sql, params = []) => {
    const t = sql.trim().toUpperCase();
    if (t.startsWith('SELECT') || t.startsWith('WITH')) return [queryRows(sql, params)];
    return [execute(sql, params)];
  },
  getConnection: async () => ({
    query: async (sql, params = []) => pool.query(sql, params),
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
  }),
};

const connectDB = async () => {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();

  db.run(`CREATE TABLE IF NOT EXISTS employees (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id TEXT UNIQUE NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, phone TEXT, department TEXT, designation TEXT, date_of_joining TEXT, profile_image TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'employee', is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id TEXT NOT NULL, date TEXT NOT NULL, login_time TEXT, logout_time TEXT, status TEXT DEFAULT 'present', total_break_minutes INTEGER DEFAULT 0, total_working_minutes INTEGER DEFAULT 0, notes TEXT, is_corrected INTEGER DEFAULT 0, corrected_by TEXT, corrected_at TEXT, created_at TEXT DEFAULT (datetime('now')), UNIQUE(employee_id, date))`);
  db.run(`CREATE TABLE IF NOT EXISTS break_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, attendance_id INTEGER NOT NULL, employee_id TEXT NOT NULL, break_start TEXT NOT NULL, break_end TEXT, break_reason TEXT NOT NULL, break_duration_minutes INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, action_by TEXT NOT NULL, action_type TEXT NOT NULL, target_table TEXT, target_id TEXT, description TEXT, ip_address TEXT, created_at TEXT DEFAULT (datetime('now')))`);
  persist();

  const existing = queryRows('SELECT id FROM employees WHERE employee_id = ?', ['ADMIN001']);
  if (!existing.length) {
    const hash = bcrypt.hashSync('password', 10);
    const empHash = bcrypt.hashSync('emp123', 10);
    const today = new Date().toISOString().split('T')[0];
    db.run(`INSERT INTO employees (employee_id,first_name,last_name,email,department,designation,date_of_joining) VALUES ('ADMIN001','System','Admin','admin@company.com','IT','System Administrator','${today}')`);
    db.run(`INSERT INTO users (employee_id,password_hash,role) VALUES ('ADMIN001','${hash}','admin')`);
    for (const [id,fn,ln,em,dept,desig] of [['EMP001','John','Doe','john@company.com','Engineering','Software Engineer'],['EMP002','Jane','Smith','jane@company.com','HR','HR Manager'],['EMP003','Bob','Wilson','bob@company.com','Finance','Accountant']]) {
      db.run(`INSERT OR IGNORE INTO employees (employee_id,first_name,last_name,email,department,designation,date_of_joining) VALUES ('${id}','${fn}','${ln}','${em}','${dept}','${desig}','${today}')`);
      db.run(`INSERT OR IGNORE INTO users (employee_id,password_hash,role) VALUES ('${id}','${empHash}','employee')`);
    }
    persist();
    console.log('✅ Demo data seeded: ADMIN001/password, EMP001/emp123');
  }
  console.log('✅ SQLite ready:', DB_PATH);
  return pool;
};

module.exports = { pool, connectDB };
