// Pure in-memory database — zero dependencies, works on Vercel serverless
// Password hashes are pre-computed to avoid bcrypt delay on cold start

// PRE-COMPUTED hashes (bcrypt cost 10):
// 'password' => $2a$10$...
// 'emp123'   => $2a$10$...
// These are generated once and hardcoded to make cold start instant.

const ADMIN_HASH = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'; // 'password'
const EMP_HASH   = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh8i'; // 'emp123' — placeholder, generated below

// We still need bcrypt for password comparison and for new passwords
const bcrypt = require('bcryptjs');

// Generate real hashes synchronously at module load (only once per cold start)
// Cost factor 8 instead of 10 for faster cold start
const REAL_ADMIN_HASH = bcrypt.hashSync('password', 8);
const REAL_EMP_HASH   = bcrypt.hashSync('emp123', 8);

// ─── In-memory store ─────────────────────────────────────────────────────────
const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const today = () => new Date().toISOString().split('T')[0];

const T = {
  employees: [
    { id: 1, employee_id: 'ADMIN001', first_name: 'System', last_name: 'Admin',  email: 'admin@company.com', phone: null, department: 'IT',          designation: 'System Administrator', date_of_joining: today(), profile_image: null, is_active: 1, created_at: now(), updated_at: now() },
    { id: 2, employee_id: 'EMP001',   first_name: 'John',   last_name: 'Doe',    email: 'john@company.com',  phone: null, department: 'Engineering', designation: 'Software Engineer',    date_of_joining: today(), profile_image: null, is_active: 1, created_at: now(), updated_at: now() },
    { id: 3, employee_id: 'EMP002',   first_name: 'Jane',   last_name: 'Smith',  email: 'jane@company.com',  phone: null, department: 'HR',          designation: 'HR Manager',           date_of_joining: today(), profile_image: null, is_active: 1, created_at: now(), updated_at: now() },
    { id: 4, employee_id: 'EMP003',   first_name: 'Bob',    last_name: 'Wilson', email: 'bob@company.com',   phone: null, department: 'Finance',     designation: 'Accountant',           date_of_joining: today(), profile_image: null, is_active: 1, created_at: now(), updated_at: now() },
  ],
  users: [
    { id: 1, employee_id: 'ADMIN001', password_hash: REAL_ADMIN_HASH, role: 'admin',    is_active: 1, created_at: now() },
    { id: 2, employee_id: 'EMP001',   password_hash: REAL_EMP_HASH,   role: 'employee', is_active: 1, created_at: now() },
    { id: 3, employee_id: 'EMP002',   password_hash: REAL_EMP_HASH,   role: 'employee', is_active: 1, created_at: now() },
    { id: 4, employee_id: 'EMP003',   password_hash: REAL_EMP_HASH,   role: 'employee', is_active: 1, created_at: now() },
  ],
  attendance:  [],
  break_logs:  [],
  audit_logs:  [],
  shift_config: [
    {
      id: 1,
      shift_start: '09:00',
      shift_end: '18:00',
      standard_hours: 9,
      max_overtime_hours: 4,
      overtime_rate: 1.5,
      updated_at: now(),
      updated_by: 'ADMIN001',
    }
  ],
};

let nextId = { employees: 5, users: 5, attendance: 1, break_logs: 1, audit_logs: 1, shift_config: 2 };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

function matchWhere(row, whereStr, params) {
  if (!whereStr || whereStr.trim() === '1=1') return true;
  const parts = whereStr.split(/\bAND\b/i);
  let pi = 0;
  for (const part of parts) {
    const p = part.trim();
    if (!p || p === '1=1') continue;
    // IS NULL / IS NOT NULL
    const nullM = p.match(/^[\w.]+\s+IS\s+(NOT\s+)?NULL/i);
    if (nullM) {
      const col = p.match(/^([\w.]+)/)[1].split('.').pop().toLowerCase();
      const isNull = !nullM[1];
      const val = row[col];
      if (isNull && (val != null && val !== '')) return false;
      if (!isNull && (val == null || val === '')) return false;
      continue;
    }
    // col LIKE ?
    const likeM = p.match(/^[\w.]+\s+LIKE\s+\?/i);
    if (likeM) {
      const col = p.match(/^([\w.]+)/)[1].split('.').pop().toLowerCase();
      const pattern = String(params[pi++]).replace(/%/g, '.*').replace(/_/g, '.');
      if (!new RegExp('^' + pattern + '$', 'i').test(String(row[col] || ''))) return false;
      continue;
    }
    // BETWEEN ? AND ?
    const betweenM = p.match(/^[\w.]+\s+BETWEEN\s+\?\s+AND\s+\?/i);
    if (betweenM) {
      const col = p.match(/^([\w.]+)/)[1].split('.').pop().toLowerCase();
      const lo = params[pi++], hi = params[pi++];
      if (row[col] < lo || row[col] > hi) return false;
      continue;
    }
    // col op ?
    const opM = p.match(/^([\w.]+)\s*(!=|>=|<=|>|<|=)\s*\?/i);
    if (opM) {
      const col = opM[1].split('.').pop().toLowerCase();
      const op = opM[2];
      const val = params[pi++];
      const rv = row[col];
      if (op === '='  && String(rv) !== String(val)) return false;
      if (op === '!=' && String(rv) === String(val)) return false;
      if (op === '>=' && !(rv >= val)) return false;
      if (op === '<=' && !(rv <= val)) return false;
      if (op === '>'  && !(rv >  val)) return false;
      if (op === '<'  && !(rv <  val)) return false;
      continue;
    }
  }
  return true;
}

function applyOrder(rows, sql) {
  const m = sql.match(/ORDER BY\s+(.+?)(?:\s+LIMIT|\s+GROUP|$)/is);
  if (!m) return rows;
  const desc = /DESC/i.test(m[1]);
  const col = m[1].replace(/\s+(ASC|DESC)/i,'').trim().split(/[\s,]/)[0].split('.').pop().toLowerCase();
  return [...rows].sort((a, b) => {
    const av = a[col] ?? '', bv = b[col] ?? '';
    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
    return 0;
  });
}

function applyLimitOffset(rows, sql, params, usedParamCount) {
  const rem = params.slice(usedParamCount);
  const lim = /LIMIT\s+\?/i.test(sql) ? parseInt(rem.shift()) : undefined;
  const off = /OFFSET\s+\?/i.test(sql) ? parseInt(rem.shift()) : 0;
  return rows.slice(off, lim !== undefined ? off + lim : undefined);
}

// Count params used in WHERE
function countWhereParams(whereStr) {
  if (!whereStr) return 0;
  const matches = whereStr.match(/\?/g);
  return matches ? matches.length : 0;
}

// ─── Query executor ───────────────────────────────────────────────────────────
function execQuery(sql, params = []) {
  const s = sql.trim();
  const up = s.toUpperCase();

  // ── SELECT ──
  if (up.startsWith('SELECT') || up.startsWith('WITH')) {
    return execSelect(s, params);
  }
  // ── INSERT ──
  if (up.startsWith('INSERT')) {
    return execInsert(s, params);
  }
  // ── UPDATE ──
  if (up.startsWith('UPDATE')) {
    return execUpdate(s, params);
  }
  return { changes: 0 };
}

function execSelect(sql, params) {
  const isJoin = /\bJOIN\b/i.test(sql);
  if (isJoin) return execJoin(sql, params);

  const fromM = sql.match(/FROM\s+(\w+)/i);
  if (!fromM) return [];
  const tname = fromM[1].toLowerCase();
  const table = T[tname] || [];

  const whereM = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s+GROUP|$)/is);
  const whereStr = whereM ? whereM[1] : '';

  let pi = 0;
  // Count params for WHERE
  const wherePCount = countWhereParams(whereStr);
  const whereParams = params.slice(0, wherePCount);
  pi = wherePCount;

  let rows = table.filter(r => matchWhere(r, whereStr, whereParams));

  rows = applyOrder(rows, sql);

  // COUNT(*)
  if (/SELECT\s+COUNT\(\*\)\s+as\s+\w+/i.test(sql) || /SELECT\s+COUNT\(\*\)/i.test(sql)) {
    const alias = sql.match(/COUNT\(\*\)\s+as\s+(\w+)/i)?.[1] || 'count';
    return [{ [alias]: rows.length }];
  }
  // COUNT(DISTINCT ...)
  if (/COUNT\(DISTINCT/i.test(sql)) {
    const alias = sql.match(/COUNT\([^)]+\)\s+as\s+(\w+)/i)?.[1] || 'count';
    const col = sql.match(/COUNT\(DISTINCT\s+[\w.]*?(\w+)\)/i)?.[1]?.toLowerCase();
    const seen = new Set(rows.map(r => r[col]));
    return [{ [alias]: seen.size }];
  }
  // COALESCE(SUM(...))
  if (/COALESCE\(SUM\(/i.test(sql)) {
    const col = sql.match(/SUM\((\w+)\)/i)?.[1]?.toLowerCase();
    const alias = sql.match(/as\s+(\w+)/i)?.[1] || 'total';
    return [{ [alias]: rows.reduce((s, r) => s + (parseInt(r[col]) || 0), 0) }];
  }

  rows = applyLimitOffset(rows, sql, params, pi);
  return rows;
}

function execJoin(sql, params) {
  // ── users JOIN employees (auth) ──
  if (/FROM\s+users\s+u\s+JOIN\s+employees\s+e/i.test(sql)) {
    const whereM = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/is);
    const whereStr = whereM ? whereM[1] : '';
    return T.users
      .map(u => {
        const e = T.employees.find(e => e.employee_id === u.employee_id);
        if (!e) return null;
        return { ...e, ...u, id: u.id };
      })
      .filter(Boolean)
      .filter(r => matchWhere(r, whereStr, params));
  }

  // ── employees LEFT JOIN users ──
  if (/FROM\s+employees\s+e\s+LEFT\s+JOIN\s+users\s+u/i.test(sql)) {
    const whereM = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/is);
    const whereStr = whereM ? whereM[1] : '';
    const wherePCount = countWhereParams(whereStr);
    const whereParams = params.slice(0, wherePCount);
    let rows = T.employees.map(e => {
      const u = T.users.find(u => u.employee_id === e.employee_id);
      return { ...e, role: u?.role, user_active: u?.is_active };
    }).filter(r => matchWhere(r, whereStr, whereParams));
    rows = applyOrder(rows, sql);
    return rows;
  }

  // ── attendance JOIN employees ──
  if (/FROM\s+attendance\s+a\s+JOIN\s+employees\s+e/i.test(sql)) {
    const whereM = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/is);
    const whereStr = whereM ? whereM[1] : '';
    const wherePCount = countWhereParams(whereStr);
    const whereParams = params.slice(0, wherePCount);

    if (/COUNT\(\*\)/i.test(sql) || /COUNT\(DISTINCT/i.test(sql)) {
      const alias = sql.match(/COUNT\([^)]+\)\s+as\s+(\w+)/i)?.[1] || 'count';
      if (/COUNT\(DISTINCT/i.test(sql)) {
        const seen = new Set();
        T.attendance.forEach(a => {
          const e = T.employees.find(e => e.employee_id === a.employee_id);
          if (e && matchWhere({ ...e, ...a }, whereStr, whereParams)) seen.add(a.employee_id);
        });
        return [{ [alias]: seen.size }];
      }
      let count = 0;
      T.attendance.forEach(a => {
        const e = T.employees.find(e => e.employee_id === a.employee_id);
        if (e && matchWhere({ ...e, ...a }, whereStr, whereParams)) count++;
      });
      return [{ [alias]: count }];
    }

    // SUM
    if (/COALESCE\(SUM\(/i.test(sql)) {
      const col = sql.match(/SUM\((\w+)\)/i)?.[1]?.toLowerCase();
      const alias = sql.match(/as\s+(\w+)/i)?.[1] || 'total';
      let total = 0;
      T.attendance.forEach(a => {
        const e = T.employees.find(e => e.employee_id === a.employee_id);
        if (e && matchWhere({ ...e, ...a }, whereStr, whereParams)) total += parseInt(a[col]) || 0;
      });
      return [{ [alias]: total }];
    }

    let rows = T.attendance.map(a => {
      const e = T.employees.find(e => e.employee_id === a.employee_id);
      if (!e) return null;
      return { ...e, ...a, id: a.id };
    }).filter(Boolean).filter(r => matchWhere(r, whereStr, whereParams));
    rows = applyOrder(rows, sql);
    rows = applyLimitOffset(rows, sql, params, wherePCount);
    return rows;
  }

  // ── break_logs JOIN attendance ──
  if (/FROM\s+break_logs\s+bl\s+JOIN\s+attendance\s+a/i.test(sql)) {
    const whereM = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/is);
    const whereStr = whereM ? whereM[1] : '';
    const wherePCount = countWhereParams(whereStr);
    const whereParams = params.slice(0, wherePCount);
    if (/COUNT\(\*\)/i.test(sql)) {
      const alias = sql.match(/COUNT\(\*\)\s+as\s+(\w+)/i)?.[1] || 'count';
      let count = 0;
      T.break_logs.forEach(bl => {
        const a = T.attendance.find(a => a.id === bl.attendance_id);
        if (a && matchWhere({ ...a, ...bl }, whereStr, whereParams)) count++;
      });
      return [{ [alias]: count }];
    }
    return T.break_logs.map(bl => {
      const a = T.attendance.find(a => a.id === bl.attendance_id);
      const e = a ? T.employees.find(e => e.employee_id === a.employee_id) : null;
      if (!a) return null;
      return { ...e, ...a, ...bl };
    }).filter(Boolean).filter(r => matchWhere(r, whereStr, whereParams));
  }

  // ── audit_logs LEFT JOIN employees ──
  if (/FROM\s+audit_logs\s+al\s+LEFT\s+JOIN\s+employees\s+e/i.test(sql)) {
    const whereM = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/is);
    const whereStr = whereM ? whereM[1] : '';
    const wherePCount = countWhereParams(whereStr);
    const whereParams = params.slice(0, wherePCount);
    let rows = T.audit_logs.map(al => {
      const e = T.employees.find(e => e.employee_id === al.action_by);
      const actor_name = e ? `${e.first_name} ${e.last_name}` : al.action_by;
      return { ...al, actor_name };
    }).filter(r => matchWhere(r, whereStr, whereParams));
    rows = applyOrder(rows, sql);
    rows = applyLimitOffset(rows, sql, params, wherePCount);
    if (/COUNT\(\*\)/i.test(sql)) {
      return [{ total: rows.length }];
    }
    return rows;
  }

  return [];
}

function execInsert(sql, params) {
  const tM = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
  if (!tM) return { changes: 0 };
  const tname = tM[1].toLowerCase();
  const table = T[tname];
  if (!table) return { changes: 0 };

  const colM = sql.match(/\(([^)]+)\)\s+VALUES/i);
  if (!colM) return { changes: 0 };
  const cols = colM[1].split(',').map(c => c.trim().toLowerCase());

  // OR IGNORE uniqueness
  if (/INSERT\s+OR\s+IGNORE/i.test(sql)) {
    const newRow = {};
    cols.forEach((c, i) => { newRow[c] = params[i]; });
    if (tname === 'employees' && table.some(r => r.employee_id === newRow.employee_id || r.email === newRow.email)) return { changes: 0 };
    if (tname === 'users' && table.some(r => r.employee_id === newRow.employee_id)) return { changes: 0 };
  }

  const id = nextId[tname]++;
  const row = { id };
  cols.forEach((c, i) => { row[c] = params[i]; });
  if (!row.created_at) row.created_at = ts();
  if (tname === 'employees') { if (!row.updated_at) row.updated_at = row.created_at; if (row.is_active === undefined) row.is_active = 1; }
  if (tname === 'users') { if (row.is_active === undefined) row.is_active = 1; }
  if (tname === 'attendance') { row.total_break_minutes = row.total_break_minutes ?? 0; row.total_working_minutes = row.total_working_minutes ?? 0; row.overtime_minutes = row.overtime_minutes ?? 0; row.is_corrected = row.is_corrected ?? 0; }
  if (tname === 'break_logs') { row.break_duration_minutes = row.break_duration_minutes ?? 0; }
  table.push(row);
  return { changes: 1, insertId: id };
}

function execUpdate(sql, params) {
  const tM = sql.match(/UPDATE\s+(\w+)/i);
  if (!tM) return { changes: 0 };
  const tname = tM[1].toLowerCase();
  const table = T[tname];
  if (!table) return { changes: 0 };

  const setM = sql.match(/SET\s+(.+?)\s+WHERE/is);
  if (!setM) return { changes: 0 };

  // Extract ?-based SET columns only
  const setCols = [];
  setM[1].split(',').forEach(p => {
    const m = p.trim().match(/^(\w+)\s*=\s*\?/i);
    if (m) setCols.push(m[1].toLowerCase());
  });

  const whereM = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/is);
  const whereStr = whereM ? whereM[1] : '';
  const wherePCount = countWhereParams(whereStr);
  const setParams = params.slice(0, setCols.length);
  const whereParams = params.slice(setCols.length, setCols.length + wherePCount);

  let changes = 0;
  for (const row of table) {
    if (matchWhere(row, whereStr, whereParams)) {
      setCols.forEach((c, i) => { row[c] = setParams[i]; });
      if (/updated_at\s*=\s*datetime\('now'\)/i.test(sql)) row.updated_at = ts();
      if (/corrected_at\s*=\s*datetime\('now'\)/i.test(sql)) row.corrected_at = ts();
      changes++;
    }
  }
  return { changes };
}

// ─── Pool interface ───────────────────────────────────────────────────────────
const pool = {
  query: async (sql, params = []) => {
    try {
      const result = execQuery(sql.trim(), params);
      const up = sql.trim().toUpperCase();
      if (up.startsWith('SELECT') || up.startsWith('WITH')) {
        return [Array.isArray(result) ? result : [result]];
      }
      return [result];
    } catch (err) {
      console.error('DB error:', err.message, '\nSQL:', sql, '\nParams:', params);
      throw err;
    }
  },
  getConnection: async () => ({
    query: async (sql, p = []) => pool.query(sql, p),
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
  }),
};

// ─── connectDB — synchronous, instant ────────────────────────────────────────
const connectDB = async () => {
  // Tables are already populated at module load time above
  console.log('✅ In-memory DB ready — ADMIN001/password, EMP001-003/emp123');
  return pool;
};

module.exports = { pool, connectDB };
