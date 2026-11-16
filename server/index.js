import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb, db } from './db/database.js';

// Import route modules
import authRouter from './routes/auth.js';
import emailsRouter from './routes/emails.js';
import aiRouter from './routes/ai.js';
import draftsRouter from './routes/drafts.js';
import tasksRouter from './routes/tasks.js';
import analyticsRouter from './routes/analytics.js';
import logsRouter from './routes/logs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables reliably from server directory
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5174';

// Middleware
app.use(cors({
  origin: [CLIENT_URL, 'http://localhost:5174', 'http://127.0.0.1:5174'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize SQLite database
initDb();

// Health check endpoint
app.get('/api/health', (req, res) => {
  try {
    const accountCount = db.prepare('SELECT COUNT(*) as count FROM accounts').get()?.count || 0;
    const emailCount = db.prepare('SELECT COUNT(*) as count FROM emails').get()?.count || 0;
    const isGeminiConfigured = Boolean(
      process.env.GEMINI_API_KEY && 
      process.env.GEMINI_API_KEY.trim() !== '' && 
      process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'
    );
    const isOAuthConfigured = Boolean(
      process.env.GOOGLE_CLIENT_ID && 
      process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here' &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_CLIENT_SECRET !== 'your_google_client_secret_here'
    );

    res.json({
      status: 'ok',
      service: 'MAILMIND AI Backend API',
      version: '1.0.0',
      database: 'connected',
      stats: {
        connectedAccounts: accountCount,
        syncedEmails: emailCount
      },
      config: {
        geminiActive: isGeminiConfigured,
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
    name: 'MAILMIND AI API',
    tagline: 'Autonomous, Privacy-First Email Intelligence Agent',
    endpoints: [
      '/api/health',
      '/api/auth',
      '/api/emails',
      '/api/ai',
      '/api/drafts',
      '/api/tasks',
      '/api/analytics',
      '/api/logs'
    ]
  });
});

// Mount modular API routers
app.use('/api/auth', authRouter);
app.use('/api/emails', emailsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/drafts', draftsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/logs', logsRouter);

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

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🧠 MAILMIND AI Server running on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Gemini Key Active: ${Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here')}`);
  console.log(`📧 Google OAuth Configured: ${Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here')}`);
  console.log(`===============================================`);
});
