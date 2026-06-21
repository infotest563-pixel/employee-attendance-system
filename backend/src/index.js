const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { connectDB } = require('./config/database');

const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');
const reportRoutes = require('./routes/reports');

const app = express();

// CORS — allow any vercel.app domain + localhost
app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/reports', reportRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Startup ──────────────────────────────────────────────────────────────────
// Initialize DB synchronously at module load so it's ready before first request
let dbInitialized = false;
let dbInitPromise = null;

const ensureDB = async () => {
  if (dbInitialized) return;
  if (!dbInitPromise) {
    dbInitPromise = connectDB().then(() => { dbInitialized = true; });
  }
  await dbInitPromise;
};

if (process.env.VERCEL) {
  // Vercel: init DB at load time, wrap handler to ensure ready
  dbInitPromise = connectDB().then(() => { dbInitialized = true; }).catch(console.error);

  module.exports = async (req, res) => {
    await ensureDB();
    return app(req, res);
  };
} else {
  // Local: start Express server normally
  const PORT = process.env.PORT || 5000;
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  }).catch(console.error);

  module.exports = app;
}
