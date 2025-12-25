import React, { useState, useEffect } from 'react';
import CodeEntry from './pages/CodeEntry';
import ExamView from './pages/ExamView';
import ExamControls from './pages/ExamControls';
import AgreementModal from './components/AgreementModal';
import { SessionInfo, studentApi, AttemptInfo } from './api/client';

type AppState = 'code_entry' | 'agreement' | 'exam';

function App() {
  const [state, setState] = useState<AppState>('code_entry');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [attempt, setAttempt] = useState<AttemptInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setError(error.response?.data?.error || 'Failed to start exam');
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
    <div className="relative">
      <CodeEntry onSessionValidated={handleSessionValidated} />

      {state === 'agreement' && session && (
        <AgreementModal
          session={session}
          onAccept={handleAgreementAccept}
          onDecline={handleAgreementDecline}
        />
      )}

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-white hover:text-red-200"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
