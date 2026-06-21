// Pure in-memory database — works 100% on Vercel serverless (no native modules)
// Data is seeded fresh on each cold start. For persistent data, use MySQL/PostgreSQL.
const bcrypt = require('bcryptjs');

// ─── In-memory tables ────────────────────────────────────────────────────────
let tables = {
  employees: [],
  users: [],
  attendance: [],
  break_logs: [],
  audit_logs: [],
};
let autoId = { employees: 1, users: 1, attendance: 1, break_logs: 1, audit_logs: 1 };

// ─── Simple SQL parser ───────────────────────────────────────────────────────
// Supports the subset of SQL used by this app

function parseSql(sql, params) {
  const s = sql.trim();
  const upper = s.toUpperCase();

  // ── SELECT ──────────────────────────────────────────────────────────────────
  if (upper.startsWith('SELECT') || upper.startsWith('WITH')) {
    return execSelect(s, params || []);
  }
  // ── INSERT ──────────────────────────────────────────────────────────────────
  if (upper.startsWith('INSERT')) {
    return execInsert(s, params || []);
  }
  // ── UPDATE ──────────────────────────────────────────────────────────────────
  if (upper.startsWith('UPDATE')) {
    return execUpdate(s, params || []);
  }
  // ── CREATE TABLE / PRAGMA ────────────────────────────────────────────────────
  return { changes: 0 };
}

// ── Table name extractor ─────────────────────────────────────────────────────
function getTable(name) {
  const n = name.toLowerCase().trim();
  if (!tables[n]) tables[n] = [];
  return tables[n];
}

// ── WHERE clause evaluator ───────────────────────────────────────────────────
function evalWhere(row, conditions, params, paramOffset) {
  let idx = paramOffset;
  for (const cond of conditions) {
    const { col, op, paramIndex } = cond;
    const val = params[paramIndex];
    const rowVal = row[col];
    if (op === '=') { if (String(rowVal) !== String(val)) return false; }
    else if (op === '!=') { if (String(rowVal) === String(val)) return false; }
    else if (op === 'IS NULL') { if (rowVal != null && rowVal !== '') return false; }
    else if (op === 'IS NOT NULL') { if (rowVal == null || rowVal === '') return false; }
    else if (op === 'LIKE') {
      const pattern = String(val).replace(/%/g, '.*').replace(/_/g, '.');
      if (!new RegExp('^' + pattern + '$', 'i').test(String(rowVal || ''))) return false;
    }
    else if (op === '>=') { if (!(rowVal >= val)) return false; }
    else if (op === '<=') { if (!(rowVal <= val)) return false; }
    else if (op === '>') { if (!(rowVal > val)) return false; }
    else if (op === '<') { if (!(rowVal < val)) return false; }
  }
  return true;
}

// ── Parse WHERE string into conditions ──────────────────────────────────────
function parseWhere(whereStr) {
  const conditions = [];
  if (!whereStr || whereStr.trim() === '1=1') return conditions;

  // Split by AND (simple, no nested)
  const parts = whereStr.split(/\bAND\b/i);
  let paramIdx = 0;
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === '1=1') continue;

    // col IS NULL / IS NOT NULL
    const isNullMatch = trimmed.match(/^(\w+)\s+IS\s+(NOT\s+)?NULL/i);
    if (isNullMatch) {
      conditions.push({ col: isNullMatch[1].toLowerCase(), op: isNullMatch[2] ? 'IS NOT NULL' : 'IS NULL', paramIndex: -1 });
      continue;
    }

    // col LIKE ?
    const likeMatch = trimmed.match(/^(\w+)\s+LIKE\s+\?/i);
    if (likeMatch) {
      conditions.push({ col: likeMatch[1].toLowerCase(), op: 'LIKE', paramIndex: paramIdx++ });
      continue;
    }

    // col op ?  (=, !=, >=, <=, >, <)
    const opMatch = trimmed.match(/^(\w+)\s*(!=|>=|<=|>|<|=)\s*\?/i);
    if (opMatch) {
      conditions.push({ col: opMatch[1].toLowerCase(), op: opMatch[2], paramIndex: paramIdx++ });
      continue;
    }

    // col NOT IN (SELECT ...) — skip for now
  }
  return conditions;
}

// ── SELECT executor ──────────────────────────────────────────────────────────
function execSelect(sql, params) {
  // Detect JOIN queries (users JOIN employees, attendance JOIN employees, etc.)
  const isJoin = /\bJOIN\b/i.test(sql);

  if (isJoin) {
    return execJoinSelect(sql, params);
  }

  // Simple single-table SELECT
  const fromMatch = sql.match(/FROM\s+(\w+)/i);
  if (!fromMatch) return [];

  const tableName = fromMatch[1].toLowerCase();
  const table = getTable(tableName);

  // WHERE
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s+GROUP|$)/is);
  const whereStr = whereMatch ? whereMatch[1] : '';
  const conditions = parseWhere(whereStr);

  // Map params
  let paramIdx = 0;
  const mappedConditions = conditions.map(c => ({
    ...c,
    paramIndex: c.paramIndex >= 0 ? paramIdx++ : -1,
  }));

  let rows = table.filter(row => evalWhere(row, mappedConditions, params, 0));

  // LIMIT / OFFSET
  const limitMatch = sql.match(/LIMIT\s+\?/i);
  const offsetMatch = sql.match(/OFFSET\s+\?/i);
  if (limitMatch || offsetMatch) {
    // params at end
    const remaining = params.slice(paramIdx);
    let lim = limitMatch ? parseInt(remaining[0]) : undefined;
    let off = offsetMatch ? parseInt(remaining[limitMatch ? 1 : 0]) : 0;
    rows = rows.slice(off, lim !== undefined ? off + lim : undefined);
  }

  // ORDER BY date DESC
  const orderMatch = sql.match(/ORDER BY\s+(.+?)(?:\s+LIMIT|\s+GROUP|$)/is);
  if (orderMatch) {
    const orderStr = orderMatch[1].trim();
    const desc = /DESC/i.test(orderStr);
    const col = orderStr.replace(/\s+(ASC|DESC)/i, '').trim().split('.').pop().toLowerCase();
    rows = [...rows].sort((a, b) => {
      const av = a[col] || '', bv = b[col] || '';
      return desc ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1);
    });
  }

  // COUNT(*)
  if (/SELECT\s+COUNT\(\*\)\s+as\s+\w+/i.test(sql)) {
    const alias = sql.match(/COUNT\(\*\)\s+as\s+(\w+)/i)?.[1] || 'count';
    return [{ [alias]: rows.length }];
  }

  // COALESCE(SUM(...))
  if (/COALESCE\(SUM\((\w+)\)/i.test(sql)) {
    const col = sql.match(/COALESCE\(SUM\((\w+)\)/i)?.[1]?.toLowerCase();
    const alias = sql.match(/as\s+(\w+)/i)?.[1] || 'total';
    const total = rows.reduce((sum, r) => sum + (parseInt(r[col]) || 0), 0);
    return [{ [alias]: total }];
  }

  return rows;
}

// ── JOIN SELECT executor ─────────────────────────────────────────────────────
function execJoinSelect(sql, params) {
  // users JOIN employees (for auth)
  if (/FROM\s+users\s+u\s+JOIN\s+employees\s+e/i.test(sql)) {
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/is);
    const whereStr = whereMatch ? whereMatch[1] : '';
    const conditions = parseWhere(whereStr);

    let paramIdx = 0;
    const mappedConds = conditions.map(c => ({ ...c, paramIndex: c.paramIndex >= 0 ? paramIdx++ : -1 }));

    const result = [];
    for (const u of tables.users) {
      const e = tables.employees.find(emp => emp.employee_id === u.employee_id);
      if (!e) continue;
      const merged = { ...e, ...u, id: u.id };
      if (evalWhere(merged, mappedConds, params, 0)) {
        result.push(merged);
      }
    }
    return result;
  }

  // attendance JOIN employees
  if (/FROM\s+attendance\s+a\s+JOIN\s+employees\s+e/i.test(sql) || /FROM\s+break_logs\s+bl\s+JOIN\s+attendance\s+a/i.test(sql)) {
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/is);
    const whereStr = whereMatch ? whereMatch[1] : '';
    const conditions = parseWhere(whereStr);

    let paramIdx = 0;
    const mappedConds = conditions.map(c => ({ ...c, paramIndex: c.paramIndex >= 0 ? paramIdx++ : -1 }));

    // break_logs JOIN attendance
    if (/FROM\s+break_logs\s+bl\s+JOIN\s+attendance\s+a/i.test(sql)) {
      if (/COUNT\(\*\)/i.test(sql)) {
        const alias = sql.match(/COUNT\(\*\)\s+as\s+(\w+)/i)?.[1] || 'count';
        let count = 0;
        for (const bl of tables.break_logs) {
          const a = tables.attendance.find(at => at.id === bl.attendance_id);
          if (!a) continue;
          const merged = { ...a, ...bl };
          if (evalWhere(merged, mappedConds, params, 0)) count++;
        }
        return [{ [alias]: count }];
      }
    }

    // COUNT on attendance JOIN employees
    if (/COUNT\(\*\)/i.test(sql) || /COUNT\(DISTINCT/i.test(sql)) {
      const alias = sql.match(/COUNT\([^)]+\)\s+as\s+(\w+)/i)?.[1] || 'count';
      const seen = new Set();
      let count = 0;
      for (const a of tables.attendance) {
        const e = tables.employees.find(emp => emp.employee_id === a.employee_id);
        if (!e) continue;
        const merged = { ...e, ...a };
        if (evalWhere(merged, mappedConds, params, 0)) {
          if (/COUNT\(DISTINCT\s+(\w+\.)?employee_id\)/i.test(sql)) {
            if (!seen.has(a.employee_id)) { seen.add(a.employee_id); count++; }
          } else {
            count++;
          }
        }
      }
      return [{ [alias]: count }];
    }

    // Regular SELECT with JOIN
    let paramIdx2 = 0;
    const mappedConds2 = conditions.map(c => ({ ...c, paramIndex: c.paramIndex >= 0 ? paramIdx2++ : -1 }));

    let result = [];
    for (const a of tables.attendance) {
      const e = tables.employees.find(emp => emp.employee_id === a.employee_id);
      if (!e) continue;
      const merged = { ...e, ...a, id: a.id };
      if (evalWhere(merged, mappedConds2, params, 0)) result.push(merged);
    }

    // ORDER BY
    const orderMatch = sql.match(/ORDER BY\s+(.+?)(?:\s+LIMIT|\s+GROUP|$)/is);
    if (orderMatch) {
      const desc = /DESC/i.test(orderMatch[1]);
      const col = orderMatch[1].replace(/\s+(ASC|DESC)/i, '').trim().split('.').pop().toLowerCase();
      result.sort((a, b) => {
        const av = a[col] || '', bv = b[col] || '';
        return desc ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1);
      });
    }

    // LIMIT/OFFSET
    const limitMatch = sql.match(/LIMIT\s+\?/i);
    const offsetMatch = sql.match(/OFFSET\s+\?/i);
    if (limitMatch || offsetMatch) {
      const remaining = params.slice(paramIdx2);
      const lim = limitMatch ? parseInt(remaining[0]) : undefined;
      const off = offsetMatch ? parseInt(remaining[limitMatch ? 1 : 0]) : 0;
      result = result.slice(off, lim !== undefined ? off + lim : undefined);
    }

    return result;
  }

  // employees LEFT JOIN users
  if (/FROM\s+employees\s+e\s+LEFT JOIN\s+users\s+u/i.test(sql)) {
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/is);
    const whereStr = whereMatch ? whereMatch[1] : '';
    const conditions = parseWhere(whereStr);
    let paramIdx = 0;
    const mappedConds = conditions.map(c => ({ ...c, paramIndex: c.paramIndex >= 0 ? paramIdx++ : -1 }));

    let result = [];
    for (const e of tables.employees) {
      const u = tables.users.find(usr => usr.employee_id === e.employee_id);
      const merged = { ...e, ...(u ? { role: u.role, user_active: u.is_active } : {}) };
      if (evalWhere(merged, mappedConds, params, 0)) result.push(merged);
    }

    const orderMatch = sql.match(/ORDER BY\s+(.+?)(?:\s+LIMIT|$)/is);
    if (orderMatch) {
      const desc = /DESC/i.test(orderMatch[1]);
      const col = orderMatch[1].replace(/\s+(ASC|DESC)/i, '').trim().split('.').pop().toLowerCase();
      result.sort((a, b) => desc ? (a[col] < b[col] ? 1 : -1) : (a[col] > b[col] ? 1 : -1));
    }
    return result;
  }

  return [];
}

// ── INSERT executor ──────────────────────────────────────────────────────────
function execInsert(sql, params) {
  const tableMatch = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
  if (!tableMatch) return { changes: 0 };

  const tableName = tableMatch[1].toLowerCase();
  const table = getTable(tableName);

  // Extract column names
  const colMatch = sql.match(/\(([^)]+)\)\s+VALUES/i);
  if (!colMatch) return { changes: 0 };

  const cols = colMatch[1].split(',').map(c => c.trim().toLowerCase());

  // Handle OR IGNORE
  const isIgnore = /INSERT\s+OR\s+IGNORE/i.test(sql);

  // Check uniqueness for OR IGNORE
  if (isIgnore) {
    const newRow = {};
    cols.forEach((col, i) => { newRow[col] = params[i]; });

    // Check unique constraints
    if (tableName === 'employees') {
      const exists = table.some(r => r.employee_id === newRow.employee_id || r.email === newRow.email);
      if (exists) return { changes: 0 };
    }
    if (tableName === 'users') {
      const exists = table.some(r => r.employee_id === newRow.employee_id);
      if (exists) return { changes: 0 };
    }
  }

  const id = autoId[tableName]++;
  const row = { id };
  cols.forEach((col, i) => { row[col] = params[i]; });

  // Defaults
  if (!row.created_at) row.created_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
  if (!row.updated_at && tableName === 'employees') row.updated_at = row.created_at;
  if (tableName === 'employees' && row.is_active === undefined) row.is_active = 1;
  if (tableName === 'users' && row.is_active === undefined) row.is_active = 1;
  if (tableName === 'attendance') {
    if (row.total_break_minutes === undefined) row.total_break_minutes = 0;
    if (row.total_working_minutes === undefined) row.total_working_minutes = 0;
    if (row.is_corrected === undefined) row.is_corrected = 0;
  }
  if (tableName === 'break_logs' && row.break_duration_minutes === undefined) row.break_duration_minutes = 0;

  table.push(row);
  return { changes: 1, insertId: id };
}

// ── UPDATE executor ──────────────────────────────────────────────────────────
function execUpdate(sql, params) {
  const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
  if (!tableMatch) return { changes: 0 };

  const tableName = tableMatch[1].toLowerCase();
  const table = getTable(tableName);

  // Extract SET clause
  const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/is);
  if (!setMatch) return { changes: 0 };

  const setParts = setMatch[1].split(',').map(s => s.trim());
  const setCols = [];
  for (const part of setParts) {
    const m = part.match(/^(\w+)\s*=\s*\?/i);
    if (m) setCols.push(m[1].toLowerCase());
    // Skip datetime('now') etc — handle below
  }

  const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/is);
  const whereStr = whereMatch ? whereMatch[1] : '';
  const conditions = parseWhere(whereStr);

  // params split: first setCols.length are SET values, rest are WHERE values
  const setParams = params.slice(0, setCols.length);
  const whereParams = params.slice(setCols.length);

  let paramIdx = 0;
  const mappedConds = conditions.map(c => ({ ...c, paramIndex: c.paramIndex >= 0 ? paramIdx++ : -1 }));

  let changes = 0;
  for (const row of table) {
    if (evalWhere(row, mappedConds, whereParams, 0)) {
      setCols.forEach((col, i) => { row[col] = setParams[i]; });
      // Handle datetime('now') fields
      if (/updated_at\s*=\s*datetime\('now'\)/i.test(sql)) row.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
      if (/corrected_at\s*=\s*datetime\('now'\)/i.test(sql)) row.corrected_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
      changes++;
    }
  }
  return { changes };
}

// ── Pool interface (same as MySQL pool) ──────────────────────────────────────
const pool = {
  query: async (sql, params = []) => {
    try {
      const result = parseSql(sql.trim(), params);
      const upper = sql.trim().toUpperCase();
      if (upper.startsWith('SELECT') || upper.startsWith('WITH')) {
        return [Array.isArray(result) ? result : [result]];
      }
      return [result];
    } catch (err) {
      console.error('DB error:', err.message, '\nSQL:', sql);
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

// ── Seed demo data ────────────────────────────────────────────────────────────
const connectDB = async () => {
  // Reset tables on each cold start
  tables = { employees: [], users: [], attendance: [], break_logs: [], audit_logs: [] };
  autoId = { employees: 1, users: 1, attendance: 1, break_logs: 1, audit_logs: 1 };

  const adminHash = bcrypt.hashSync('password', 10);
  const empHash = bcrypt.hashSync('emp123', 10);
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const seedEmployees = [
    ['ADMIN001', 'System',  'Admin', 'admin@company.com', 'IT',          'System Administrator'],
    ['EMP001',   'John',    'Doe',   'john@company.com',  'Engineering', 'Software Engineer'   ],
    ['EMP002',   'Jane',    'Smith', 'jane@company.com',  'HR',          'HR Manager'          ],
    ['EMP003',   'Bob',     'Wilson','bob@company.com',   'Finance',     'Accountant'          ],
  ];

  for (const [eid, fn, ln, em, dept, desig] of seedEmployees) {
    tables.employees.push({ id: autoId.employees++, employee_id: eid, first_name: fn, last_name: ln, email: em, phone: null, department: dept, designation: desig, date_of_joining: today, profile_image: null, is_active: 1, created_at: now, updated_at: now });
  }

  tables.users.push({ id: autoId.users++, employee_id: 'ADMIN001', password_hash: adminHash, role: 'admin',    is_active: 1, created_at: now });
  tables.users.push({ id: autoId.users++, employee_id: 'EMP001',   password_hash: empHash,   role: 'employee', is_active: 1, created_at: now });
  tables.users.push({ id: autoId.users++, employee_id: 'EMP002',   password_hash: empHash,   role: 'employee', is_active: 1, created_at: now });
  tables.users.push({ id: autoId.users++, employee_id: 'EMP003',   password_hash: empHash,   role: 'employee', is_active: 1, created_at: now });

  console.log('✅ In-memory DB ready — ADMIN001/password, EMP001-003/emp123');
  return pool;
};

module.exports = { pool, connectDB };
