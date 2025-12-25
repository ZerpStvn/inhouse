import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import Layout from '../components/Layout';
import { sessionsApi, ExamSession, ExamAttempt } from '../api/client';

interface StudentCard {
  attemptId: string;
  studentName: string;
  studentId: string | null;
  startedAt: string;
  status: 'active' | 'completed' | 'terminated';
  violations: Violation[];
  lastActivity: string;
  isOnline: boolean;
}

interface Violation {
  type: string;
  description: string;
  timestamp: string;
  details?: string;
}

interface ViolationEvent {
  attemptId: string;
  studentName: string;
  studentId: string | null;
  sessionId: string;
  sessionName: string;
  violation: Violation;
  totalViolations: number;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function LiveMonitor() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<ExamSession | null>(null);
  const [students, setStudents] = useState<Map<string, StudentCard>>(new Map());
  const [recentViolations, setRecentViolations] = useState<ViolationEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  // Load session and existing attempts
  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      try {
        const sessionData = await sessionsApi.getOne(id);
        setSession(sessionData);

        // Initialize students from existing attempts
        const studentMap = new Map<string, StudentCard>();
        sessionData.attempts?.forEach((attempt: ExamAttempt) => {
          if (attempt.status === 'active') {
            const violations = attempt.violations ? JSON.parse(attempt.violations) : [];
            studentMap.set(attempt.id, {
              attemptId: attempt.id,
              studentName: attempt.studentName || 'Anonymous',
              studentId: attempt.studentId || null,
              startedAt: attempt.startedAt,
              status: attempt.status as 'active',
              violations,
              lastActivity: attempt.startedAt,
              isOnline: true,
            });
          }
        });
        setStudents(studentMap);
      } catch (error) {
        console.error('Failed to load session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [id]);

  // Setup Socket.IO connection
  useEffect(() => {
    if (!id) return;

    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      socket.emit('join-session', id);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    // Handle new student joining
    socket.on('student-joined', (data) => {
      console.log('Student joined:', data);
      setStudents((prev) => {
        const newMap = new Map(prev);
        newMap.set(data.attemptId, {
          attemptId: data.attemptId,
          studentName: data.studentName,
          studentId: data.studentId,
          startedAt: data.startedAt,
          status: 'active',
          violations: [],
          lastActivity: new Date().toISOString(),
          isOnline: true,
        });
        return newMap;
      });
    });

    // Handle student leaving
    socket.on('student-left', (data) => {
      console.log('Student left:', data);
      setStudents((prev) => {
        const newMap = new Map(prev);
        const student = newMap.get(data.attemptId);
        if (student) {
          newMap.set(data.attemptId, {
            ...student,
            status: data.status,
            isOnline: false,
          });
        }
        return newMap;
      });
    });

    // Handle violations
    socket.on('violation', (data: ViolationEvent) => {
      console.log('Violation received:', data);

      // Update student's violation count
      setStudents((prev) => {
        const newMap = new Map(prev);
        const student = newMap.get(data.attemptId);
        if (student) {
          newMap.set(data.attemptId, {
            ...student,
            violations: [...student.violations, data.violation],
            lastActivity: new Date().toISOString(),
          });
        }
        return newMap;
      });

      // Add to recent violations feed
      setRecentViolations((prev) => [data, ...prev].slice(0, 50));
    });

    // Handle heartbeat
    socket.on('student-heartbeat', (data) => {
      setStudents((prev) => {
        const newMap = new Map(prev);
        const student = newMap.get(data.attemptId);
        if (student) {
          newMap.set(data.attemptId, {
            ...student,
            lastActivity: data.timestamp,
            isOnline: true,
          });
        }
        return newMap;
      });
    });

    return () => {
      socket.emit('leave-session', id);
      socket.disconnect();
    };
  }, [id]);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString();
  };

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getViolationIcon = (type: string) => {
    switch (type) {
      case 'shortcut_blocked':
      case 'key_blocked':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        );
      case 'focus_lost':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
    }
  };

  const activeStudents = Array.from(students.values()).filter((s) => s.status === 'active');

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)]">
          <p className="text-slate-500 mb-4">Session not found</p>
          <Link to="/" className="text-indigo-600 hover:text-indigo-700 font-medium">
            Back to Dashboard
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-8 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link to={`/sessions/${id}`} className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500">Live Monitor</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{session.name}</h1>
              <p className="text-slate-500 mt-1">Real-time student monitoring</p>
            </div>
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
              }`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                {isConnected ? 'Connected' : 'Disconnected'}
              </div>
              <div className="text-sm text-slate-500">
                <span className="font-semibold text-slate-900">{activeStudents.length}</span> active students
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-12rem)]">
        {/* Student Grid */}
        <div className="flex-1 p-6 overflow-auto">
          {activeStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="text-lg font-medium text-slate-700 mb-2">No active students</h3>
              <p className="text-slate-500">Students will appear here when they join the exam</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {activeStudents.map((student) => (
                <div
                  key={student.attemptId}
                  className={`bg-white rounded-xl border-2 p-4 transition-all ${
                    student.violations.length > 0
                      ? 'border-amber-300 shadow-amber-100 shadow-lg'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Student Avatar & Name */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                      student.violations.length > 5
                        ? 'bg-red-500'
                        : student.violations.length > 0
                        ? 'bg-amber-500'
                        : 'bg-indigo-500'
                    }`}>
                      {student.studentName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-slate-900 truncate">{student.studentName}</h4>
                      {student.studentId && (
                        <p className="text-xs text-slate-500 truncate">{student.studentId}</p>
                      )}
                    </div>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      student.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                    }`}></div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                    <span>Duration: {formatDuration(student.startedAt)}</span>
                  </div>

                  {/* Violations Badge */}
                  <div className={`flex items-center justify-between p-2 rounded-lg ${
                    student.violations.length > 0 ? 'bg-amber-50' : 'bg-slate-50'
                  }`}>
                    <div className="flex items-center gap-2">
                      {student.violations.length > 0 ? (
                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      <span className={`font-medium ${
                        student.violations.length > 0 ? 'text-amber-700' : 'text-emerald-700'
                      }`}>
                        {student.violations.length} violations
                      </span>
                    </div>
                  </div>

                  {/* Recent Violation Preview */}
                  {student.violations.length > 0 && (
                    <div className="mt-2 text-xs text-amber-600 truncate">
                      Last: {student.violations[student.violations.length - 1].description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Violation Feed Sidebar */}
        <div className="w-80 border-l border-slate-200 bg-slate-50 flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-white">
            <h3 className="font-semibold text-slate-900">Violation Feed</h3>
            <p className="text-xs text-slate-500">Real-time alerts from students</p>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {recentViolations.length === 0 ? (
              <div className="text-center text-slate-400 text-sm py-8">
                No violations yet
              </div>
            ) : (
              recentViolations.map((v, index) => (
                <div
                  key={`${v.attemptId}-${v.violation.timestamp}-${index}`}
                  className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm animate-fade-in"
                >
                  <div className="flex items-start gap-2">
                    <div className="p-1.5 rounded-full bg-amber-100 text-amber-600 flex-shrink-0">
                      {getViolationIcon(v.violation.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-900 text-sm truncate">
                          {v.studentName}
                        </span>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {formatTime(v.violation.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        {v.violation.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                          {v.violation.type.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-amber-600 font-medium">
                          #{v.totalViolations}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </Layout>
  );
}
