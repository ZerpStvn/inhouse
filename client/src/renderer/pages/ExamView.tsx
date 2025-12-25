import React, { useState, useEffect, useRef } from 'react';
import { studentApi } from '../api/client';

interface ExamViewProps {
  attemptId: string;
  allowedUrls: string[];
  sessionName: string;
  endTime: string | null;
}

export default function ExamView({
  attemptId,
  allowedUrls,
  sessionName,
  endTime,
}: ExamViewProps) {
  const [currentUrl, setCurrentUrl] = useState(allowedUrls[0] || '');
  const [showAdminExit, setShowAdminExit] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [examWindowOpened, setExamWindowOpened] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const examWindowRef = useRef<Window | null>(null);

  // Check if running in Electron
  const isElectron = !!window.electronAPI;

  // Calculate time remaining
  useEffect(() => {
    if (!endTime) return;

    const updateTime = () => {
      const end = new Date(endTime).getTime();
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        setTimeRemaining('Time is up!');
        handleExamEnd('time_expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  // Listen for violation reports from main process
  useEffect(() => {
    if (window.electronAPI) {
      const unsubscribe = window.electronAPI.onReportViolation(async (data) => {
        try {
          await studentApi.reportViolation(data);
        } catch (error) {
          console.error('Failed to report violation:', error);
        }
      });
      return unsubscribe;
    }
  }, []);

  // Check attempt status periodically
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await studentApi.checkStatus(attemptId);
        if (status.shouldTerminate) {
          handleExamEnd('terminated');
        }
      } catch (error) {
        console.error('Failed to check status:', error);
      }
    };

    const interval = setInterval(checkStatus, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [attemptId]);

  // Disable right-click
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Disable keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block F keys, Ctrl+key combinations, etc.
      if (
        e.key.startsWith('F') ||
        e.ctrlKey ||
        e.altKey ||
        e.metaKey
      ) {
        e.preventDefault();
        return false;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleExamEnd = async (reason: string) => {
    if (isEnding) return;
    setIsEnding(true);

    try {
      await studentApi.endAttempt(attemptId, reason);
      if (window.electronAPI) {
        await window.electronAPI.endExam();
      }
    } catch (error) {
      console.error('Failed to end exam:', error);
    }
  };

  const handleAdminExit = async () => {
    if (!window.electronAPI) return;

    setAdminError('');
    const result = await window.electronAPI.adminExit(adminPassword);

    if (result.success) {
      await studentApi.endAttempt(attemptId, 'admin_terminated');
    } else {
      setAdminError(result.error || 'Invalid password');
    }
  };

  const handleSubmitExam = async () => {
    if (confirm('Are you sure you want to submit your exam? This action cannot be undone.')) {
      await handleExamEnd('completed');
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900">
      {/* Top Bar */}
      <div className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="font-medium">{sessionName}</span>
          </div>
          {allowedUrls.length > 1 && (
            <select
              value={currentUrl}
              onChange={(e) => setCurrentUrl(e.target.value)}
              className="bg-gray-700 text-white px-3 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {allowedUrls.map((url, i) => (
                <option key={i} value={url}>
                  {new URL(url).hostname}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {timeRemaining && (
            <div
              className={`px-3 py-1 rounded font-mono text-sm ${
                timeRemaining.includes('s') && !timeRemaining.includes('m')
                  ? 'bg-red-600 animate-pulse'
                  : 'bg-gray-700'
              }`}
            >
              Time: {timeRemaining}
            </div>
          )}
          <button
            onClick={handleSubmitExam}
            className="bg-green-600 hover:bg-green-700 px-4 py-1 rounded text-sm font-medium transition-colors"
          >
            Submit Exam
          </button>
          <button
            onClick={() => setShowAdminExit(true)}
            className="text-gray-400 hover:text-white text-xs"
          >
            Admin Exit
          </button>
        </div>
      </div>

      {/* Exam Content */}
      <div className="flex-1 bg-white relative">
        {!isElectron && !examWindowOpened ? (
          // Browser mode - show message and open in new window
          <div className="flex flex-col items-center justify-center h-full bg-gray-100 p-8">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Browser Mode Detected</h2>
              <p className="text-gray-600 mb-4">
                The exam website cannot be embedded in this browser due to security restrictions.
                For full lockdown features, please use the Electron desktop application.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                For testing purposes, you can open the exam in a new window:
              </p>
              <button
                onClick={() => {
                  examWindowRef.current = window.open(currentUrl, '_blank', 'width=1200,height=800');
                  setExamWindowOpened(true);
                }}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Open Exam in New Window
              </button>
              <p className="text-xs text-gray-400 mt-4">
                Note: Lockdown features are not active in browser mode
              </p>
            </div>
          </div>
        ) : !isElectron && examWindowOpened ? (
          // Browser mode - exam window opened
          <div className="flex flex-col items-center justify-center h-full bg-gray-100 p-8">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Exam Window Opened</h2>
              <p className="text-gray-600 mb-4">
                Your exam is open in a separate window. Complete your exam there.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                When you're done, click "Submit Exam" above to end your session.
              </p>
              <button
                onClick={() => {
                  if (examWindowRef.current && !examWindowRef.current.closed) {
                    examWindowRef.current.focus();
                  } else {
                    examWindowRef.current = window.open(currentUrl, '_blank', 'width=1200,height=800');
                  }
                }}
                className="bg-gray-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                Focus Exam Window
              </button>
            </div>
          </div>
        ) : (
          // Electron mode - use iframe (or webview in production)
          <iframe
            ref={iframeRef}
            src={currentUrl}
            className="w-full h-full border-none"
            sandbox="allow-forms allow-scripts allow-same-origin"
            title="Exam Content"
            onError={() => setIframeError(true)}
          />
        )}
      </div>

      {/* Admin Exit Modal */}
      {showAdminExit && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Admin Exit
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter the admin password to exit the exam.
            </p>
            {adminError && (
              <div className="bg-red-50 text-red-600 p-2 rounded mb-4 text-sm">
                {adminError}
              </div>
            )}
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Admin password"
              className="w-full px-3 py-2 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAdminExit(false);
                  setAdminPassword('');
                  setAdminError('');
                }}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdminExit}
                className="flex-1 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Exit Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security Watermark */}
      <div className="fixed bottom-2 right-2 text-xs text-gray-400 opacity-50 pointer-events-none">
        Secure Exam Browser
      </div>
    </div>
  );
}
