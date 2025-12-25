import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { sessionsApi, ExamSession, ExamAttempt } from '../api/client';

interface Violation {
  type: string;
  description: string;
  timestamp: string;
  details?: string;
}

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<(ExamSession & { attempts: ExamAttempt[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (id) {
      loadSession();
      const interval = setInterval(loadSession, 10000);
      return () => clearInterval(interval);
    }
  }, [id]);

  const loadSession = async () => {
    try {
      const data = await sessionsApi.getOne(id!);
      setSession(data);
    } catch {
      setError('Failed to load session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateCode = async () => {
    if (!confirm('Are you sure? Students with the old code won\'t be able to join.')) return;
    try {
      await sessionsApi.regenerateCode(id!);
      loadSession();
    } catch {
      setError('Failed to regenerate code');
    }
  };

  const handleTerminateAttempt = async (attemptId: string) => {
    if (!confirm('Are you sure you want to terminate this student\'s exam?')) return;
    try {
      await sessionsApi.terminateAttempt(attemptId);
      loadSession();
    } catch {
      setError('Failed to terminate attempt');
    }
  };

  const formatCode = (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`;

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleString();
  };

  const parseViolations = (violations: string | null): Violation[] => {
    if (!violations) return [];
    try {
      return JSON.parse(violations);
    } catch {
      return [];
    }
  };

  const copyCode = () => {
    if (session) {
      navigator.clipboard.writeText(formatCode(session.accessCode));
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

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
          <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-slate-500 mb-4">Session not found</p>
          <Link to="/" className="text-indigo-600 hover:text-indigo-700 font-medium">
            Back to Dashboard
          </Link>
        </div>
      </Layout>
    );
  }

  const allowedUrls = JSON.parse(session.allowedUrls);
  const activeAttempts = session.attempts.filter((a) => a.status === 'active');
  const completedAttempts = session.attempts.filter((a) => a.status !== 'active');

  return (
    <Layout>
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-8 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/" className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500">Sessions</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-semibold text-slate-900">{session.name}</h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                session.isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${session.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                {session.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to={`/sessions/${session.id}/monitor`}
                className="inline-flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Live Monitor
              </Link>
              <Link
                to={`/sessions/${session.id}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </Link>
            </div>
          </div>
          {session.description && (
            <p className="text-slate-500 mt-2">{session.description}</p>
          )}
        </div>
      </div>

      <div className="p-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
            <button onClick={() => setError('')} className="text-red-800 hover:text-red-900">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Session Info Cards */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Access Code Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-medium text-slate-500 mb-3">Access Code</h3>
            <div className="flex items-center gap-3">
              <code className="text-2xl font-mono font-semibold text-slate-900">
                {formatCode(session.accessCode)}
              </code>
              <button
                onClick={copyCode}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Copy code"
              >
                {copiedCode ? (
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
            <button
              onClick={handleRegenerateCode}
              className="mt-3 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Regenerate code
            </button>
          </div>

          {/* Time Window Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-medium text-slate-500 mb-3">Time Window</h3>
            <div className="space-y-2">
              <div>
                <span className="text-xs text-slate-400">Start</span>
                <p className="text-slate-900">{formatDate(session.startTime)}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">End</span>
                <p className="text-slate-900">{formatDate(session.endTime)}</p>
              </div>
            </div>
          </div>

          {/* Allowed URLs Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-medium text-slate-500 mb-3">Allowed URLs</h3>
            <div className="space-y-2 max-h-24 overflow-y-auto">
              {allowedUrls.map((url: string, i: number) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-indigo-600 hover:text-indigo-700 truncate"
                >
                  {url}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Active Students */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Active Students</h2>
              {activeAttempts.length > 0 && (
                <span className="inline-flex items-center justify-center w-6 h-6 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                  {activeAttempts.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              Auto-refreshing
            </div>
          </div>

          {activeAttempts.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-slate-500">No students currently taking the exam</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Started</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Violations</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {activeAttempts.map((attempt) => {
                  const violations = parseViolations(attempt.violations);
                  return (
                    <tr key={attempt.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <span className="font-medium text-slate-900">{attempt.studentName || 'Unknown'}</span>
                          {attempt.studentId && (
                            <span className="text-slate-500 ml-2">({attempt.studentId})</span>
                          )}
                        </div>
                        <div className="text-sm text-slate-400">{attempt.ipAddress}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {new Date(attempt.startedAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        {violations.length > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
                            {violations.length} violation{violations.length !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                            Clean
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleTerminateAttempt(attempt.id)}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          Terminate
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Completed Attempts */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Completed Attempts</h2>
              {completedAttempts.length > 0 && (
                <span className="inline-flex items-center justify-center w-6 h-6 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                  {completedAttempts.length}
                </span>
              )}
            </div>
          </div>

          {completedAttempts.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-slate-500">No completed attempts yet</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Violations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {completedAttempts.map((attempt) => {
                  const violations = parseViolations(attempt.violations);
                  const duration = attempt.endedAt
                    ? Math.round((new Date(attempt.endedAt).getTime() - new Date(attempt.startedAt).getTime()) / 60000)
                    : '—';
                  return (
                    <tr key={attempt.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-medium text-slate-900">{attempt.studentName || 'Unknown'}</span>
                        {attempt.studentId && (
                          <span className="text-slate-500 ml-2">({attempt.studentId})</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {duration} min
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          attempt.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}>
                          {attempt.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {violations.length > 0 ? (
                          <details className="group">
                            <summary className="cursor-pointer text-red-600 text-sm font-medium list-none flex items-center gap-1">
                              {violations.length} violation{violations.length !== 1 ? 's' : ''}
                              <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </summary>
                            <ul className="mt-2 space-y-1 text-sm text-slate-600">
                              {violations.map((v, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-slate-400">•</span>
                                  <span><span className="font-medium">{v.type}:</span> {v.description}</span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : (
                          <span className="text-emerald-600 text-sm">None</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
