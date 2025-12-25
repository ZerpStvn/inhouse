import express from 'express';
import cors from 'cors';
import adminRoutes from './routes/admin';
import studentRoutes from './routes/student';

const app = express();
const PORT = process.env.PORT || 3001;

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',  // Admin dev
  'http://localhost:5174',  // Client dev
  process.env.ADMIN_URL,    // Admin production
  process.env.CLIENT_ORIGIN, // Client production (Electron)
].filter(Boolean) as string[];

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like Electron apps, mobile apps, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('API Endpoints:');
  console.log('  POST /api/admin/register - Register new admin');
  console.log('  POST /api/admin/login - Admin login');
  console.log('  GET  /api/admin/sessions - List exam sessions');
  console.log('  POST /api/admin/sessions - Create exam session');
  console.log('  POST /api/student/validate-code - Validate access code');
  console.log('  POST /api/student/start-attempt - Start exam attempt');
});
