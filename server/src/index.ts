import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import adminRoutes from './routes/admin';
import studentRoutes from './routes/student';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Socket.IO setup with CORS
const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true,
  },
});

// Make io available to routes
app.set('io', io);

// CORS - Allow all origins for now
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Handle preflight requests
app.options('*', cors());
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

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Admin joins a session room to receive updates
  socket.on('join-session', (sessionId: string) => {
    socket.join(`session:${sessionId}`);
    console.log(`Socket ${socket.id} joined session:${sessionId}`);
  });

  // Admin leaves a session room
  socket.on('leave-session', (sessionId: string) => {
    socket.leave(`session:${sessionId}`);
    console.log(`Socket ${socket.id} left session:${sessionId}`);
  });

  // Admin joins all sessions for overview
  socket.on('join-all-sessions', () => {
    socket.join('all-sessions');
    console.log(`Socket ${socket.id} joined all-sessions`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
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

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('WebSocket enabled for real-time updates');
  console.log('API Endpoints:');
  console.log('  POST /api/admin/register - Register new admin');
  console.log('  POST /api/admin/login - Admin login');
  console.log('  GET  /api/admin/sessions - List exam sessions');
  console.log('  POST /api/admin/sessions - Create exam session');
  console.log('  POST /api/student/validate-code - Validate access code');
  console.log('  POST /api/student/start-attempt - Start exam attempt');
});
