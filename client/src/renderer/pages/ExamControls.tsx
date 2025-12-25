import { useState, useEffect } from 'react';
import { studentApi } from '../api/client';

interface ViolationNotification {
  id: string;
  type: string;
  message: string;
  appName?: string;
  timestamp: Date;
}

export default function ExamControls() {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [currentWarning, setCurrentWarning] = useState<ViolationNotification | null>(null);

  useEffect(() => {
    const loadAttemptId = async () => {
      if (window.electronAPI) {
        const id = await window.electronAPI.getAttemptId();
        setAttemptId(id);
        setStartTime(new Date());
      }
    };
    loadAttemptId();
  }, []);

  // Listen for violation reports from main process
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubscribe = window.electronAPI.onReportViolation(async (data) => {
      const { attemptId: id, violation } = data;

      // Create warning notification
      const warning: ViolationNotification = {
        id: Date.now().toString(),
        type: violation.type,
        message: getViolationMessage(violation.type, violation.description),
        appName: extractAppOrShortcutName(violation.type, violation.description),
        timestamp: new Date(),
      };

      setCurrentWarning(warning);

      // Remove warning after 4 seconds
      setTimeout(() => {
        setCurrentWarning((prev) => (prev?.id === warning.id ? null : prev));
      }, 4000);

      // Report to server
      try {
        await studentApi.reportViolation({
          attemptId: id,
          violation: {
            type: violation.type,
            description: violation.description,
            details: violation.details,
          },
        });
      } catch (error) {
        console.error('Failed to report violation:', error);
      }
    });

    return unsubscribe;
  }, []);

  // Send heartbeat every 30 seconds
  useEffect(() => {
    if (!attemptId) return;

    const interval = setInterval(async () => {
      try {
        await studentApi.heartbeat(attemptId);
      } catch (error) {
        console.error('Heartbeat failed:', error);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [attemptId]);

  // Timer effect
  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      setElapsedTime(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const extractAppOrShortcutName = (type: string, description: string): string | undefined => {
    // For app_opened: "Attempted to open: AppName"
    if (type === 'app_opened') {
      const match = description.match(/Attempted to open: (.+)/);
      return match ? match[1] : 'application';
    }
    // For shortcut_blocked with Alt+Tab or Win+Tab
    if (type === 'shortcut_blocked') {
      if (description.includes('Alt+Tab')) {
        return 'Alt+Tab (Task Switcher)';
      }
      if (description.includes('Win+Tab')) {
        return 'Win+Tab (Task View)';
      }
      // Other shortcuts
      const match = description.match(/Blocked: (.+)/);
      return match ? match[1] : undefined;
    }
    return undefined;
  };

  const getViolationMessage = (type: string, description: string): string => {
    switch (type) {
      case 'app_opened':
        return description;
      case 'shortcut_blocked':
        if (description.includes('Alt+Tab') || description.includes('Win+Tab')) {
          return 'Attempted to switch windows';
        }
        return description;
      case 'key_blocked':
        return 'Blocked key';
      case 'focus_lost':
        return 'Window switch detected';
      default:
        return 'Violation detected';
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFinishExam = async () => {
    if (confirm('Are you sure you want to finish your exam? This action cannot be undone.')) {
      setIsFinishing(true);
      try {
        if (attemptId) {
          await studentApi.endAttempt(attemptId, 'completed');
        }
        if (window.electronAPI) {
          await window.electronAPI.endExam();
        }
      } catch (error) {
        console.error('Failed to end exam:', error);
        setIsFinishing(false);
      }
    }
  };

  return (
    <div className="relative">
      {/* Warning banner - shows above control bar when violation detected */}
      {currentWarning && (
        <div className="fixed top-[-80px] right-0 w-[300px] animate-slide-down">
          <div className="bg-red-600 text-white rounded-lg shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-red-700 px-3 py-1.5 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-wide">Warning</span>
            </div>
            {/* Content */}
            <div className="px-3 py-2">
              {currentWarning.appName ? (
                <>
                  <p className="text-sm font-medium">
                    {currentWarning.type === 'shortcut_blocked' ? 'Attempted to use:' : 'Attempting to open:'}
                  </p>
                  <p className="text-lg font-bold">{currentWarning.appName}</p>
                </>
              ) : (
                <p className="text-sm font-medium">{currentWarning.message}</p>
              )}
              <p className="text-xs text-red-200 mt-1">Sent to your instructor</p>
            </div>
          </div>
        </div>
      )}

      {/* Main control bar */}
      <div className={`h-[60px] w-[300px] flex items-center justify-between px-4 rounded-lg shadow-2xl border transition-colors duration-300 ${
        currentWarning
          ? 'bg-red-900 border-red-600'
          : 'bg-slate-900 border-slate-700'
      }`}>
        <div className="flex items-center space-x-3">
          <div className={`w-2 h-2 rounded-full animate-pulse ${
            currentWarning ? 'bg-red-400' : 'bg-emerald-500'
          }`}></div>
          <div className="flex flex-col">
            <span className="text-white text-xs font-medium">
              {currentWarning ? 'Violation Detected' : 'Exam in Progress'}
            </span>
            <span className={`text-sm font-mono ${
              currentWarning ? 'text-red-300' : 'text-emerald-400'
            }`}>
              {formatTime(elapsedTime)}
            </span>
          </div>
        </div>

        <button
          onClick={handleFinishExam}
          disabled={isFinishing}
          className="bg-red-600 hover:bg-red-700 disabled:bg-slate-600 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors"
        >
          {isFinishing ? 'Finishing...' : 'Finish Exam'}
        </button>
      </div>

      <style>{`
        @keyframes slide-down {
          from {
            transform: translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
