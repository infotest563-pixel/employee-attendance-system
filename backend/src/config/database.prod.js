// Production database config — uses MySQL (for Railway/PlanetScale)
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

const connectDB = async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL (Production) connected');
    conn.release();
    return pool;
  } catch (error) {
    console.error('❌ DB connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = { pool, connectDB };
