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
import calendarRouter from './routes/calendar.js';
import campusRouter from './routes/campus.js';
import settingsRouter from './routes/settings.js';

const app = express();
const PORT = process.env.PORT || 5001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5174';

// Middleware
app.use(cors({
  origin: [CLIENT_URL, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://127.0.0.1:5174', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(cookieParser(process.env.SESSION_SECRET || 'mailmind-session-secret'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
app.use('/api/calendar', calendarRouter);
app.use('/api/campus', campusRouter);
app.use('/api/settings', settingsRouter);

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

export { app };
export default app;

const isMainModule = Boolean(process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]));
if (isMainModule && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🧠 MAILMIND AI Multi-User Server running on port ${PORT}`);
    console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`⚡ Groq AI Active: ${Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.startsWith('gsk_'))}`);
    console.log(`📧 Google OAuth Configured: ${Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here')}`);
    console.log(`🔒 AES-256-GCM Token Encryption: Active`);
    console.log(`===============================================`);
  });
}
