import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables reliably from server directory
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { initDb, db } from './db/database.js';

// Route handlers
import authRouter from './routes/auth.js';
import emailsRouter from './routes/emails.js';
import aiRouter from './routes/ai.js';
import draftsRouter from './routes/drafts.js';
import analyticsRouter from './routes/analytics.js';
import logsRouter from './routes/logs.js';
import tasksRouter from './routes/tasks.js';
import shieldRouter from './routes/shield.js';
import autopilotRouter from './routes/autopilot.js';
import attackLabRouter from './routes/attackLab.js';
import sendersRouter from './routes/senders.js';

const app = express();
const PORT = process.env.PORT || 5001;

// Trust reverse proxy (Render / Vercel) for secure cookies and protocol detection
app.set('trust proxy', 1);

// Helper to resolve dynamically allowed origins
function getAllowedOrigins() {
  const allowed = [];
  if (process.env.CLIENT_ORIGIN) {
    process.env.CLIENT_ORIGIN.split(',').forEach(o => {
      const trimmed = o.trim();
      if (trimmed) {
        try { allowed.push(new URL(trimmed).origin); } catch (_) { allowed.push(trimmed); }
      }
    });
  }
  if (process.env.APP_URL) {
    try { allowed.push(new URL(process.env.APP_URL).origin); } catch (_) { allowed.push(process.env.APP_URL); }
  }
  if (process.env.CLIENT_URL) {
    try { allowed.push(new URL(process.env.CLIENT_URL).origin); } catch (_) { allowed.push(process.env.CLIENT_URL); }
  }
  // In development and testing, automatically include localhost variants
  if (process.env.NODE_ENV !== 'production') {
    allowed.push(
      'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175',
      'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:5175'
    );
  }
  return [...new Set(allowed)];
}

// CORS middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = getAllowedOrigins();
    if (allowed.length === 0 || allowed.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true
}));

app.use(cookieParser(process.env.SESSION_SECRET || 'mailmind-session-secret'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 1. Enforce Cache-Control: no-store on all /api responses (zero caching of private user data)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// 2. CSRF / Origin Validation: Compares incoming request Origin against allowed origins
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.headers.origin;
    if (origin) {
      const allowed = getAllowedOrigins();
      if (allowed.length > 0 && !allowed.includes(origin)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Request origin does not match configured APP_URL or CLIENT_ORIGIN.',
          code: 'CSRF_ORIGIN_MISMATCH'
        });
      }
    }
  }
  next();
});

// Initialize SQLite database
initDb();

// Health check endpoint
app.get('/api/health', (req, res) => {
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get()?.count || 0;
    const emailCount = db.prepare('SELECT COUNT(*) as count FROM emails').get()?.count || 0;
    const activeSessions = db.prepare('SELECT COUNT(*) as count FROM sessions WHERE expires_at > ?').get(Date.now())?.count || 0;
    const isAIConfigured = Boolean(
      process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.startsWith('gsk_')
    );
    const isOAuthConfigured = Boolean(
      process.env.GOOGLE_CLIENT_ID && 
      process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here' &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_CLIENT_SECRET !== 'your_google_client_secret_here'
    );

    res.json({
      status: 'ok',
      service: 'MAILMIND AI Multi-User Backend API',
      version: '2.0.0',
      database: 'connected',
      multiUser: true,
      stats: {
        totalUsers: userCount,
        activeSessions,
        syncedEmails: emailCount
      },
      config: {
        aiActive: isAIConfigured,
        geminiActive: isAIConfigured, // backwards compatibility
        aiEngine: 'Groq LPU (Ultra-Fast)',
        oauthConfigured: isOAuthConfigured
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
});

// Root API welcome
app.get('/api', (req, res) => {
  res.json({
    name: 'MAILMIND AI Multi-User API',
    tagline: 'Autonomous, Privacy-First Email Intelligence Agent',
    version: '2.0.0',
    endpoints: [
      '/api/health',
      '/api/auth/google',
      '/api/auth/callback',
      '/api/auth/me',
      '/api/auth/logout',
      '/api/emails',
      '/api/emails/sync',
      '/api/ai',
      '/api/drafts',
      '/api/analytics',
      '/api/logs',
      '/api/tasks'
    ]
  });
});

// Mount modular API routers
app.use('/api/auth', authRouter);
app.use('/api/emails', emailsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/drafts', draftsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/logs', logsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/shield', shieldRouter);
app.use('/api/autopilot', autopilotRouter);
app.use('/api/attack-lab', attackLabRouter);
app.use('/api/senders', sendersRouter);

// Serve client in production when dist exists
const clientDistPath = path.resolve(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.resolve(clientDistPath, 'index.html'));
  });
}

// Central error handler
app.use((err, req, res, next) => {
  console.error('[MAILMIND Server Error]', err);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal Server Error',
    code: err.code || null
  });
});

/**
 * Validates required environment variables for deployment.
 * Never prints secret values to console/logs; only lists missing variable names.
 */
export function validateEnvironment(env = process.env, shouldExit = true) {
  const isProduction = env.NODE_ENV === 'production';
  const REQUIRED_VARS = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
    'GROQ_API_KEY',
    'TOKEN_ENC_KEY',
    'SESSION_SECRET'
  ];

  if (isProduction || env.NODE_ENV === 'test_prod_validation') {
    REQUIRED_VARS.push('APP_URL');
  }

  const missing = REQUIRED_VARS.filter(key => {
    const val = env[key];
    return !val || typeof val !== 'string' || val.trim() === '' || val.startsWith('your_');
  });

  if (missing.length > 0) {
    const errorMsg = `[Startup Error] Missing required environment variable(s): ${missing.join(', ')}. Please configure them before starting the server.`;
    console.error(errorMsg);
    if (shouldExit && process.env.NODE_ENV !== 'test' && env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    const err = new Error(errorMsg);
    err.missingVars = missing;
    throw err;
  }
}

export { app };
export default app;

const isMainModule = Boolean(process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]));
if (isMainModule && process.env.NODE_ENV !== 'test') {
  validateEnvironment();
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🧠 MAILMIND AI Multi-User Server running on port ${PORT}`);
    console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`⚡ Groq AI Active: ${Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.startsWith('gsk_'))}`);
    console.log(`📧 Google OAuth Configured: ${Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here')}`);
    console.log(`🔒 AES-256-GCM Token Encryption: Active`);
    console.log(`🌐 Public App URL: ${process.env.APP_URL || 'Not specified'}`);
    console.log(`===============================================`);
  });
}
