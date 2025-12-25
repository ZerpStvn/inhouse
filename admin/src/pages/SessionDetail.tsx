import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
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

  useEffect(() => {
    if (id) {
      loadSession();
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
    if (!date) return 'Not set';
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Session not found</p>
          <Link to="/" className="text-blue-600 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const allowedUrls = JSON.parse(session.allowedUrls);
  const activeAttempts = session.attempts.filter((a) => a.status === 'active');
  const completedAttempts = session.attempts.filter((a) => a.status !== 'active');

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link to="/" className="text-blue-600 hover:text-blue-800">
            &larr; Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">
            {error}
          </div>
        )}

        {/* Session Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{session.name}</h1>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    session.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {session.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              {session.description && (
                <p className="text-gray-600 mt-2">{session.description}</p>
              )}
            </div>
            <Link
              to={`/sessions/${session.id}/edit`}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
            >
              Edit Session
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Access Code</h3>
              <div className="flex items-center gap-3 mt-1">
                <code className="bg-gray-100 px-3 py-2 rounded font-mono text-2xl">
                  {formatCode(session.accessCode)}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(formatCode(session.accessCode))}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Copy
                </button>
                <button
                  onClick={handleRegenerateCode}
                  className="text-gray-600 hover:text-gray-800"
                >
                  Regenerate
                </button>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Time Window</h3>
              <p className="mt-1">
                <span className="text-gray-900">Start:</span> {formatDate(session.startTime)}
              </p>
              <p>
                <span className="text-gray-900">End:</span> {formatDate(session.endTime)}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Allowed URLs</h3>
            <div className="space-y-1">
              {allowedUrls.map((url: string, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-blue-600">{url}</span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-600"
                  >
                    (open)
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Active Students */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Active Students ({activeAttempts.length})
          </h2>
          {activeAttempts.length === 0 ? (
            <p className="text-gray-500">No students currently taking the exam.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-sm font-medium text-gray-500">Student</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-500">Started</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-500">Violations</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAttempts.map((attempt) => {
                    const violations = parseViolations(attempt.violations);
                    return (
                      <tr key={attempt.id} className="border-b">
                        <td className="py-3">
                          <div>
                            <span className="font-medium">
                              {attempt.studentName || 'Unknown'}
                            </span>
                            {attempt.studentId && (
                              <span className="text-gray-500 ml-2">
                                ({attempt.studentId})
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{attempt.ipAddress}</div>
                        </td>
                        <td className="py-3 text-sm">
                          {new Date(attempt.startedAt).toLocaleString()}
                        </td>
                        <td className="py-3">
                          {violations.length > 0 ? (
                            <span className="text-red-600 font-medium">
                              {violations.length} violation(s)
                            </span>
                          ) : (
                            <span className="text-green-600">None</span>
                          )}
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => handleTerminateAttempt(attempt.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Terminate
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Completed Attempts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Completed/Terminated Attempts ({completedAttempts.length})
          </h2>
          {completedAttempts.length === 0 ? (
            <p className="text-gray-500">No completed attempts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-sm font-medium text-gray-500">Student</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-500">Duration</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-500">Status</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-500">Violations</th>
                  </tr>
                </thead>
                <tbody>
                  {completedAttempts.map((attempt) => {
                    const violations = parseViolations(attempt.violations);
                    const duration = attempt.endedAt
                      ? Math.round(
                          (new Date(attempt.endedAt).getTime() -
                            new Date(attempt.startedAt).getTime()) /
                            60000
                        )
                      : '-';
                    return (
                      <tr key={attempt.id} className="border-b">
                        <td className="py-3">
                          <div>
                            <span className="font-medium">
                              {attempt.studentName || 'Unknown'}
                            </span>
                            {attempt.studentId && (
                              <span className="text-gray-500 ml-2">
                                ({attempt.studentId})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-sm">{duration} minutes</td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              attempt.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {attempt.status}
                          </span>
                        </td>
                        <td className="py-3">
                          {violations.length > 0 ? (
                            <details>
                              <summary className="text-red-600 cursor-pointer">
                                {violations.length} violation(s)
                              </summary>
                              <ul className="mt-2 text-sm space-y-1">
                                {violations.map((v, i) => (
                                  <li key={i} className="text-gray-600">
                                    {v.type}: {v.description}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ) : (
                            <span className="text-green-600">None</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
