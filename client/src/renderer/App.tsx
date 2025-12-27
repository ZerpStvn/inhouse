import { useState, useEffect } from 'react';
import CodeEntry from './pages/CodeEntry';
import ExamView from './pages/ExamView';
import ExamControls from './pages/ExamControls';
import AgreementModal from './components/AgreementModal';
import { SessionInfo, studentApi, AttemptInfo } from './api/client';

type AppState = 'code_entry' | 'agreement' | 'exam';

interface ErrorNotification {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info';
}

function App() {
  const [state, setState] = useState<AppState>('code_entry');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [attempt, setAttempt] = useState<AttemptInfo | null>(null);
  const [notifications, setNotifications] = useState<ErrorNotification[]>([]);

  // Check if we're in exam controls mode (small control bar)
  const isExamControls = window.location.hash === '#/exam-controls';

  // Check if we're in exam mode (hash contains /exam)
  useEffect(() => {
    const checkExamMode = async () => {
      if (window.location.hash === '#/exam' && window.electronAPI) {
        const urls = await window.electronAPI.getAllowedUrls();
        const attemptId = await window.electronAPI.getAttemptId();

        if (urls && urls.length > 0 && attemptId) {
          setAttempt({
            attemptId,
            sessionId: '',
            sessionName: 'Secure Exam',
            allowedUrls: urls,
            startedAt: new Date().toISOString(),
            endTime: null,
          });
          setState('exam');
        }
      }
    };
    checkExamMode();
  }, []);

  const showNotification = (message: string, type: 'error' | 'warning' | 'info' = 'error') => {
    const id = Date.now().toString();
    setNotifications((prev) => [...prev, { id, message, type }]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleSessionValidated = (validatedSession: SessionInfo) => {
    setSession(validatedSession);
    setState('agreement');
  };

  const handleAgreementAccept = async (studentName: string, studentId: string) => {
    if (!session) return;

    try {
      const attemptInfo = await studentApi.startAttempt({
        sessionId: session.sessionId,
        studentName,
        studentId,
      });

      setAttempt(attemptInfo);

      // Start exam mode in Electron
      if (window.electronAPI) {
        await window.electronAPI.startExam({
          urls: attemptInfo.allowedUrls,
          attemptId: attemptInfo.attemptId,
        });
      } else {
        // Running in browser (dev mode without Electron)
        setState('exam');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      showNotification(error.response?.data?.error || 'Failed to start exam');
    }
  };

  const handleAgreementDecline = () => {
    setSession(null);
    setState('code_entry');
  };

  // Render exam controls (small control bar window)
  if (isExamControls) {
    return <ExamControls />;
  }

  // Render based on state
  if (state === 'exam' && attempt) {
    return (
      <ExamView
        attemptId={attempt.attemptId}
        allowedUrls={attempt.allowedUrls}
        sessionName={attempt.sessionName}
        endTime={attempt.endTime}
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-900">
      <CodeEntry onSessionValidated={handleSessionValidated} />

      {state === 'agreement' && session && (
        <AgreementModal
          session={session}
          onAccept={handleAgreementAccept}
          onDecline={handleAgreementDecline}
        />
      )}

      {/* Notification Stack */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`animate-slide-up flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-sm max-w-sm ${
              notification.type === 'error'
                ? 'bg-red-500/90 border-red-400/50 text-white'
                : notification.type === 'warning'
                ? 'bg-amber-500/90 border-amber-400/50 text-white'
                : 'bg-blue-500/90 border-blue-400/50 text-white'
            }`}
          >
            {notification.type === 'error' && (
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {notification.type === 'warning' && (
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            {notification.type === 'info' && (
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
