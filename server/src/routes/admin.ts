import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthRequest, authMiddleware, generateToken } from '../middleware/auth';
import { generateAccessCode } from '../utils/codeGenerator';

const router = Router();
const prisma = new PrismaClient();

// Register new admin (only if no admins exist, or for additional admins)
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({ where: { email } });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin
    const admin = await prisma.admin.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    // Generate token
    const token = generateToken({ id: admin.id, email: admin.email });

    res.status(201).json({ admin, token });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register admin' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find admin
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken({ id: admin.id, email: admin.email });

    res.json({
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Get current admin profile
router.get('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.adminId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    res.json(admin);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Get all exam sessions for current admin
router.get('/sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await prisma.examSession.findMany({
      where: { adminId: req.adminId },
      include: {
        _count: {
          select: { attempts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(sessions);
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// Get single exam session
router.get('/sessions/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const session = await prisma.examSession.findFirst({
      where: {
        id: req.params.id,
        adminId: req.adminId,
      },
      include: {
        attempts: {
          orderBy: { startedAt: 'desc' },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// Create new exam session
router.post('/sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, allowedUrls, startTime, endTime } = req.body;

    if (!name || !allowedUrls || !Array.isArray(allowedUrls) || allowedUrls.length === 0) {
      return res.status(400).json({ error: 'Name and at least one allowed URL are required' });
    }

    // Validate URLs
    for (const url of allowedUrls) {
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: `Invalid URL: ${url}` });
      }
    }

    // Generate unique access code
    let accessCode: string;
    let isUnique = false;
    do {
      accessCode = generateAccessCode();
      const existing = await prisma.examSession.findUnique({ where: { accessCode } });
      isUnique = !existing;
    } while (!isUnique);

    const session = await prisma.examSession.create({
      data: {
        name,
        description: description || null,
        allowedUrls: JSON.stringify(allowedUrls),
        accessCode,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        adminId: req.adminId!,
      },
    });

    res.status(201).json(session);
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Update exam session
router.put('/sessions/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, allowedUrls, isActive, startTime, endTime } = req.body;

    // Verify ownership
    const existing = await prisma.examSession.findFirst({
      where: {
        id: req.params.id,
        adminId: req.adminId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Validate URLs if provided
    if (allowedUrls) {
      if (!Array.isArray(allowedUrls) || allowedUrls.length === 0) {
        return res.status(400).json({ error: 'At least one allowed URL is required' });
      }
      for (const url of allowedUrls) {
        try {
          new URL(url);
        } catch {
          return res.status(400).json({ error: `Invalid URL: ${url}` });
        }
      }
    }

    const session = await prisma.examSession.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(allowedUrls && { allowedUrls: JSON.stringify(allowedUrls) }),
        ...(isActive !== undefined && { isActive }),
        ...(startTime !== undefined && { startTime: startTime ? new Date(startTime) : null }),
        ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
      },
    });

    res.json(session);
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Delete exam session
router.delete('/sessions/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Verify ownership
    const existing = await prisma.examSession.findFirst({
      where: {
        id: req.params.id,
        adminId: req.adminId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await prisma.examSession.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// Regenerate access code
router.post('/sessions/:id/regenerate-code', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Verify ownership
    const existing = await prisma.examSession.findFirst({
      where: {
        id: req.params.id,
        adminId: req.adminId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Generate new unique access code
    let accessCode: string;
    let isUnique = false;
    do {
      accessCode = generateAccessCode();
      const existingCode = await prisma.examSession.findUnique({ where: { accessCode } });
      isUnique = !existingCode;
    } while (!isUnique);

    const session = await prisma.examSession.update({
      where: { id: req.params.id },
      data: { accessCode },
    });

    res.json(session);
  } catch (error) {
    console.error('Regenerate code error:', error);
    res.status(500).json({ error: 'Failed to regenerate code' });
  }
});

// Get session attempts/students
router.get('/sessions/:id/attempts', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Verify ownership
    const session = await prisma.examSession.findFirst({
      where: {
        id: req.params.id,
        adminId: req.adminId,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const attempts = await prisma.examAttempt.findMany({
      where: { sessionId: req.params.id },
      orderBy: { startedAt: 'desc' },
    });

    res.json(attempts);
  } catch (error) {
    console.error('Get attempts error:', error);
    res.status(500).json({ error: 'Failed to get attempts' });
  }
});

// Terminate a student's attempt
router.post('/attempts/:id/terminate', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: req.params.id },
      include: { session: true },
    });

    if (!attempt || attempt.session.adminId !== req.adminId) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    const updatedAttempt = await prisma.examAttempt.update({
      where: { id: req.params.id },
      data: {
        status: 'terminated',
        endedAt: new Date(),
      },
    });

    res.json(updatedAttempt);
  } catch (error) {
    console.error('Terminate attempt error:', error);
    res.status(500).json({ error: 'Failed to terminate attempt' });
  }
});

export default router;
