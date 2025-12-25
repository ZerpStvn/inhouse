import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { normalizeCode } from '../utils/codeGenerator';
import { Server } from 'socket.io';

const router = Router();
const prisma = new PrismaClient();

// Helper to get Socket.IO instance
const getIO = (req: any): Server => req.app.get('io');

// Validate access code and get session info
router.post('/validate-code', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Access code is required' });
    }

    const normalizedCode = normalizeCode(code);

    const session = await prisma.examSession.findUnique({
      where: { accessCode: normalizedCode },
      select: {
        id: true,
        name: true,
        description: true,
        allowedUrls: true,
        isActive: true,
        startTime: true,
        endTime: true,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Invalid access code' });
    }

    if (!session.isActive) {
      return res.status(403).json({ error: 'This exam session is not active' });
    }

    // Check time constraints
    const now = new Date();
    if (session.startTime && now < session.startTime) {
      return res.status(403).json({
        error: 'This exam has not started yet',
        startTime: session.startTime,
      });
    }

    if (session.endTime && now > session.endTime) {
      return res.status(403).json({
        error: 'This exam has ended',
        endTime: session.endTime,
      });
    }

    // Parse allowed URLs
    const allowedUrls = JSON.parse(session.allowedUrls);

    res.json({
      sessionId: session.id,
      name: session.name,
      description: session.description,
      allowedUrls,
      startTime: session.startTime,
      endTime: session.endTime,
    });
  } catch (error) {
    console.error('Validate code error:', error);
    res.status(500).json({ error: 'Failed to validate code' });
  }
});

// Start exam attempt
router.post('/start-attempt', async (req, res) => {
  try {
    const { sessionId, studentName, studentId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Verify session exists and is active
    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.isActive) {
      return res.status(403).json({ error: 'This exam session is not active' });
    }

    // Get client info
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Create attempt
    const attempt = await prisma.examAttempt.create({
      data: {
        sessionId,
        studentName: studentName || null,
        studentId: studentId || null,
        ipAddress,
        userAgent,
        status: 'active',
      },
    });

    // Return session info with attempt
    const allowedUrls = JSON.parse(session.allowedUrls);

    // Emit real-time event for new student joining
    const io = getIO(req);
    const studentData = {
      attemptId: attempt.id,
      studentName: studentName || 'Anonymous',
      studentId: studentId || null,
      sessionId: session.id,
      sessionName: session.name,
      startedAt: attempt.startedAt,
      status: 'active',
      violations: [],
      lastActivity: new Date().toISOString(),
    };

    io.to(`session:${sessionId}`).emit('student-joined', studentData);
    io.to('all-sessions').emit('student-joined', studentData);

    res.status(201).json({
      attemptId: attempt.id,
      sessionId: session.id,
      sessionName: session.name,
      allowedUrls,
      startedAt: attempt.startedAt,
      endTime: session.endTime,
    });
  } catch (error) {
    console.error('Start attempt error:', error);
    res.status(500).json({ error: 'Failed to start attempt' });
  }
});

// Report security violation
router.post('/report-violation', async (req, res) => {
  try {
    const { attemptId, violation } = req.body;

    if (!attemptId || !violation) {
      return res.status(400).json({ error: 'Attempt ID and violation are required' });
    }

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        session: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    // Parse existing violations or create new array
    const existingViolations = attempt.violations
      ? JSON.parse(attempt.violations)
      : [];

    // Create violation object with timestamp
    const newViolation = {
      type: violation.type,
      description: violation.description,
      timestamp: new Date().toISOString(),
      details: violation.details || null,
    };

    // Add new violation
    existingViolations.push(newViolation);

    // Update attempt with new violation
    await prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        violations: JSON.stringify(existingViolations),
      },
    });

    // Emit real-time violation event
    const io = getIO(req);
    const violationData = {
      attemptId,
      studentName: attempt.studentName || 'Anonymous',
      studentId: attempt.studentId,
      sessionId: attempt.session.id,
      sessionName: attempt.session.name,
      violation: newViolation,
      totalViolations: existingViolations.length,
    };

    io.to(`session:${attempt.session.id}`).emit('violation', violationData);
    io.to('all-sessions').emit('violation', violationData);

    res.json({ message: 'Violation reported' });
  } catch (error) {
    console.error('Report violation error:', error);
    res.status(500).json({ error: 'Failed to report violation' });
  }
});

// End exam attempt
router.post('/end-attempt', async (req, res) => {
  try {
    const { attemptId, reason } = req.body;

    if (!attemptId) {
      return res.status(400).json({ error: 'Attempt ID is required' });
    }

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        session: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    if (attempt.status !== 'active') {
      return res.status(400).json({ error: 'Attempt already ended' });
    }

    const newStatus = reason === 'completed' ? 'completed' : 'terminated';

    const updatedAttempt = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        status: newStatus,
        endedAt: new Date(),
      },
    });

    // Emit real-time event for student leaving
    const io = getIO(req);
    const leaveData = {
      attemptId,
      studentName: attempt.studentName || 'Anonymous',
      studentId: attempt.studentId,
      sessionId: attempt.session.id,
      sessionName: attempt.session.name,
      status: newStatus,
      endedAt: updatedAttempt.endedAt,
    };

    io.to(`session:${attempt.session.id}`).emit('student-left', leaveData);
    io.to('all-sessions').emit('student-left', leaveData);

    res.json({
      message: 'Attempt ended',
      attempt: updatedAttempt,
    });
  } catch (error) {
    console.error('End attempt error:', error);
    res.status(500).json({ error: 'Failed to end attempt' });
  }
});

// Heartbeat - student sends periodic updates
router.post('/heartbeat', async (req, res) => {
  try {
    const { attemptId } = req.body;

    if (!attemptId) {
      return res.status(400).json({ error: 'Attempt ID is required' });
    }

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        session: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    // Emit heartbeat to admin
    const io = getIO(req);
    io.to(`session:${attempt.session.id}`).emit('student-heartbeat', {
      attemptId,
      timestamp: new Date().toISOString(),
    });

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Failed to process heartbeat' });
  }
});

// Check attempt status (for polling)
router.get('/attempt/:id/status', async (req, res) => {
  try {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: req.params.id },
      include: {
        session: {
          select: {
            isActive: true,
            endTime: true,
          },
        },
      },
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    // Check if session was deactivated or ended
    const now = new Date();
    const shouldTerminate =
      !attempt.session.isActive ||
      (attempt.session.endTime && now > attempt.session.endTime) ||
      attempt.status === 'terminated';

    res.json({
      status: attempt.status,
      shouldTerminate,
      endTime: attempt.session.endTime,
    });
  } catch (error) {
    console.error('Check status error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

export default router;
