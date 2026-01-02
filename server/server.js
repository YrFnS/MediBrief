import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables FIRST before any other imports
const envPath = join(__dirname, '.env');
console.log('📁 Loading .env from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Error loading .env:', result.error);
} else {
  console.log('✅ .env loaded successfully');
  console.log('  GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✓ Set (length: ' + process.env.GOOGLE_CLIENT_ID.length + ')' : '✗ Missing');
  console.log('  GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✓ Set' : '✗ Missing');
}

import express from 'express';
import cors from 'cors';
import session from 'express-session';
import FileStoreFactory from 'session-file-store';
import authRouter from './routes/auth.js';
import geminiRouter from './routes/gemini.js';

const FileStore = FileStoreFactory(session);

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration - allow credentials for session cookies
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Body parser
app.use(express.json());

// Session configuration with file-based storage (persists across restarts)
app.use(session({
  store: new FileStore({
    path: join(__dirname, 'sessions'),
    ttl: 7 * 24 * 60 * 60, // 7 days in seconds
    retries: 0,
    logFn: () => { } // Suppress verbose logging
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS attacks
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // Required for cross-site cookies (Netlify -> Render)
  }
}));
// Helper for production: Trust the first proxy (Render/Heroku/etc)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Routes
app.use('/auth', authRouter);
app.use('/api', geminiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🚀 MediBrief server running on http://localhost:${PORT}`);
  console.log(`📡 CORS enabled for: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
  console.log(`🔐 Session secret: ${process.env.SESSION_SECRET ? '✓ Set' : '⚠ Using default (insecure)'}`);
});
