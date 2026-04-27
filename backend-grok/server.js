// server.js — From Negative Production Entry Point
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Use Google DNS to fix SRV lookup issues
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { connectDB, getDB } = require('./config/database');
const securityHeaders = require('./middleware/security');
const requestLogger = require('./middleware/logger');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

const app = express();

// ── Global Middleware ──
app.set('trust proxy', 1); // Trust first proxy (Nginx)
app.use(securityHeaders);
app.use(requestLogger);

// CORS
if (config.isProduction && process.env.ALLOWED_ORIGINS) {
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || config.cors.allowedOrigins.includes(origin)) cb(null, true);
      else cb(new Error('CORS blocked'));
    },
    credentials: true,
  }));
} else {
  app.use(cors());
}

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ── Static Files ──
app.use(express.static(path.join(__dirname, 'client', 'build')));

// ── Health Check (verifies DB is alive) ──
app.get('/health', async (req, res) => {
  const db = getDB();
  let dbStatus = 'disconnected';
  if (db) {
    try {
      await db.command({ ping: 1 });
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }
  }
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    database: dbStatus,
    environment: config.nodeEnv,
  });
});

// ── Routes ──
app.use('/api', publicRoutes);
app.use('/admin', adminRoutes);

// ── React SPA Catch-All ──
app.get('*path', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'build', 'index.html'));
});

// ── Global Error Handler ──
app.use((error, req, res, next) => {
  console.error(`[Error] [${req.requestId || '-'}] ${error.message}`);
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: config.isProduction ? 'Internal server error' : error.message,
    });
  }
});

// ── Process Safety ──
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled:', reason);
});

// ── Start ──
connectDB().then(() => {
  app.listen(config.port, () => {
    console.log(`\n  DermaAI Server: http://localhost:${config.port}`);
    console.log(`  Environment: ${config.nodeEnv}`);
    console.log(`  Admin: ${config.admin.key ? 'ENABLED' : 'DISABLED (set ADMIN_KEY)'}\n`);
  });
});

module.exports = app;
