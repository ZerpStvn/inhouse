import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sessionsApi, ExamSession } from '../api/client';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const data = await sessionsApi.getAll();
      setSessions(data);
    } catch {
      setError('Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (session: ExamSession) => {
    try {
      await sessionsApi.update(session.id, { isActive: !session.isActive });
      loadSessions();
    } catch {
      setError('Failed to update session');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    try {
      await sessionsApi.delete(id);
      loadSessions();
    } catch {
      setError('Failed to delete session');
    }
  };

  const formatCode = (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`;

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(formatCode(code));
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Secure Exam Browser</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">Welcome, {user?.name}</span>
            <button
              onClick={logout}
              className="text-red-600 hover:text-red-800"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Exam Sessions</h2>
          <Link
            to="/sessions/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Create New Session
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-4">No exam sessions yet.</p>
            <Link
              to="/sessions/new"
              className="text-blue-600 hover:underline"
            >
              Create your first session
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="bg-white rounded-lg shadow p-6"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {session.name}
                      </h3>
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
                      <p className="text-gray-600 mt-1">{session.description}</p>
                    )}
                    <div className="mt-3 flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Access Code:</span>
                        <code className="bg-gray-100 px-2 py-1 rounded font-mono text-lg">
                          {formatCode(session.accessCode)}
                        </code>
                        <button
                          onClick={() => copyCode(session.accessCode)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                          title="Copy code"
                        >
                          Copy
                        </button>
                      </div>
                      <span className="text-sm text-gray-500">
                        {session._count?.attempts || 0} attempts
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      URLs: {JSON.parse(session.allowedUrls).length} allowed
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/sessions/${session.id}`}
                      className="text-blue-600 hover:text-blue-800 px-3 py-1"
                    >
                      View
                    </Link>
                    <Link
                      to={`/sessions/${session.id}/edit`}
                      className="text-gray-600 hover:text-gray-800 px-3 py-1"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleToggleActive(session)}
                      className={`px-3 py-1 ${
                        session.isActive
                          ? 'text-yellow-600 hover:text-yellow-800'
                          : 'text-green-600 hover:text-green-800'
                      }`}
                    >
                      {session.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(session.id)}
                      className="text-red-600 hover:text-red-800 px-3 py-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
