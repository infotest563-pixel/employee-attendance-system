// Uses Node.js built-in sqlite (Node 22+) — zero dependencies, works on Vercel
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// On Vercel use /tmp (only writable dir); locally use data/
const DATA_DIR = process.env.VERCEL
  ? '/tmp'
  : path.join(__dirname, '../../data');

const DB_PATH = path.join(DATA_DIR, 'attendance.db');

if (!process.env.VERCEL && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db = null;

const getDb = () => {
  if (!db) {
    // Node 22+ built-in sqlite
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
  }
  return db;
};

const pool = {
  query: async (sql, params = []) => {
    const database = getDb();
    const t = sql.trim().toUpperCase();
    try {
      if (t.startsWith('SELECT') || t.startsWith('WITH')) {
        const stmt = database.prepare(sql);
        const rows = stmt.all(...(params || []));
        return [rows];
      } else {
        const stmt = database.prepare(sql);
        const result = stmt.run(...(params || []));
        return [{ changes: result.changes, insertId: result.lastInsertRowid }];
      }
    } catch (err) {
      console.error('DB query error:', err.message, '\nSQL:', sql);
      throw err;
    }
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
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      department TEXT,
      designation TEXT,
      date_of_joining TEXT,
      profile_image TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT NOT NULL,
      date TEXT NOT NULL,
      login_time TEXT,
      logout_time TEXT,
      status TEXT DEFAULT 'present',
      total_break_minutes INTEGER DEFAULT 0,
      total_working_minutes INTEGER DEFAULT 0,
      notes TEXT,
      is_corrected INTEGER DEFAULT 0,
      corrected_by TEXT,
      corrected_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(employee_id, date)
    );
    CREATE TABLE IF NOT EXISTS break_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attendance_id INTEGER NOT NULL,
      employee_id TEXT NOT NULL,
      break_start TEXT NOT NULL,
      break_end TEXT,
      break_reason TEXT NOT NULL,
      break_duration_minutes INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_by TEXT NOT NULL,
      action_type TEXT NOT NULL,
      target_table TEXT,
      target_id TEXT,
      description TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed demo data
  const existing = database.prepare('SELECT id FROM employees WHERE employee_id = ?').get('ADMIN001');
  if (!existing) {
    const adminHash = bcrypt.hashSync('password', 10);
    const empHash = bcrypt.hashSync('emp123', 10);
    const today = new Date().toISOString().split('T')[0];

    const insertEmp = database.prepare(
      `INSERT OR IGNORE INTO employees (employee_id,first_name,last_name,email,department,designation,date_of_joining)
       VALUES (?,?,?,?,?,?,?)`
    );
    const insertUser = database.prepare(
      `INSERT OR IGNORE INTO users (employee_id,password_hash,role) VALUES (?,?,?)`
    );

    insertEmp.run('ADMIN001','System','Admin','admin@company.com','IT','System Administrator',today);
    insertUser.run('ADMIN001', adminHash, 'admin');
    insertEmp.run('EMP001','John','Doe','john@company.com','Engineering','Software Engineer',today);
    insertUser.run('EMP001', empHash, 'employee');
    insertEmp.run('EMP002','Jane','Smith','jane@company.com','HR','HR Manager',today);
    insertUser.run('EMP002', empHash, 'employee');
    insertEmp.run('EMP003','Bob','Wilson','bob@company.com','Finance','Accountant',today);
    insertUser.run('EMP003', empHash, 'employee');

    console.log('✅ Seeded: ADMIN001/password, EMP001-003/emp123');
  }

  console.log('✅ node:sqlite ready:', DB_PATH);
  return pool;
};

module.exports = { pool, connectDB };
