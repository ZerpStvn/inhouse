import { useState, useEffect, useRef } from 'react';
import { studentApi } from '../api/client';

interface ViolationNotification {
  id: string;
  type: string;
  message: string;
  appName?: string;
  timestamp: Date;
}

interface LockPenalty {
  isLocked: boolean;
  lockEndTime: Date | null;
  penaltyLevel: number;
  remainingSeconds: number;
}

// Penalty durations in seconds for each level
const PENALTY_DURATIONS = [
  120,   // Level 1: 2 minutes
  300,   // Level 2: 5 minutes
  600,   // Level 3: 10 minutes
  900,   // Level 4: 15 minutes
  1800,  // Level 5+: 30 minutes
];

export default function ExamControls() {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [currentWarning, setCurrentWarning] = useState<ViolationNotification | null>(null);
  const [violationCount, setViolationCount] = useState(0);
  const [isConnected, setIsConnected] = useState(true);
  const [lockPenalty, setLockPenalty] = useState<LockPenalty>({
    isLocked: false,
    lockEndTime: null,
    penaltyLevel: 0,
    remainingSeconds: 0,
  });

  const lockIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Cleanup lock interval on unmount
  useEffect(() => {
    return () => {
      if (lockIntervalRef.current) {
        clearInterval(lockIntervalRef.current);
      }
    };
  }, []);

  // Handle penalty lock countdown
  useEffect(() => {
    if (lockPenalty.isLocked && lockPenalty.lockEndTime) {
      lockIntervalRef.current = setInterval(() => {
        const now = new Date();
        const remaining = Math.max(0, Math.ceil((lockPenalty.lockEndTime!.getTime() - now.getTime()) / 1000));

        if (remaining <= 0) {
          setLockPenalty(prev => ({
            ...prev,
            isLocked: false,
            lockEndTime: null,
            remainingSeconds: 0,
          }));
          if (lockIntervalRef.current) {
            clearInterval(lockIntervalRef.current);
          }
        } else {
          setLockPenalty(prev => ({
            ...prev,
            remainingSeconds: remaining,
          }));
        }
      }, 1000);

      return () => {
        if (lockIntervalRef.current) {
          clearInterval(lockIntervalRef.current);
        }
      };
    }
  }, [lockPenalty.isLocked, lockPenalty.lockEndTime]);

  // Apply penalty lock
  const applyPenaltyLock = (newPenaltyLevel: number) => {
    const durationIndex = Math.min(newPenaltyLevel - 1, PENALTY_DURATIONS.length - 1);
    const lockDuration = PENALTY_DURATIONS[durationIndex];
    const lockEndTime = new Date(Date.now() + lockDuration * 1000);

    setLockPenalty({
      isLocked: true,
      lockEndTime,
      penaltyLevel: newPenaltyLevel,
      remainingSeconds: lockDuration,
    });
  };

  // Listen for violation reports from main process
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubscribe = window.electronAPI.onReportViolation(async (data) => {
      const { attemptId: id, violation } = data;

      // Increment violation count
      const newViolationCount = violationCount + 1;
      setViolationCount(newViolationCount);

      // Check if this is a serious violation that triggers a lock penalty
      const seriousViolations = ['app_opened', 'shortcut_blocked'];
      if (seriousViolations.includes(violation.type)) {
        // Calculate new penalty level (every 2 serious violations increases penalty)
        const newPenaltyLevel = Math.floor(newViolationCount / 2) + 1;
        if (newPenaltyLevel > lockPenalty.penaltyLevel || !lockPenalty.isLocked) {
          applyPenaltyLock(newPenaltyLevel);
        }
      }

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
        setIsConnected(true);
      } catch (error) {
        console.error('Failed to report violation:', error);
        setIsConnected(false);
      }
    });

    return unsubscribe;
  }, [violationCount, lockPenalty.penaltyLevel, lockPenalty.isLocked]);

  // Send heartbeat every 30 seconds
  useEffect(() => {
    if (!attemptId) return;

    const interval = setInterval(async () => {
      try {
        await studentApi.heartbeat(attemptId);
        setIsConnected(true);
      } catch (error) {
        console.error('Heartbeat failed:', error);
        setIsConnected(false);
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
    if (type === 'app_opened') {
      const match = description.match(/Attempted to open: (.+)/);
      return match ? match[1] : 'application';
    }
    if (type === 'shortcut_blocked') {
      if (description.includes('Alt+Tab')) {
        return 'Alt+Tab (Task Switcher)';
      }
      if (description.includes('Win+Tab')) {
        return 'Win+Tab (Task View)';
      }
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
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatLockTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
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

  const getStatusColor = () => {
    if (lockPenalty.isLocked) return 'from-orange-600 to-orange-700';
    if (currentWarning) return 'from-red-600 to-red-700';
    if (!isConnected) return 'from-amber-600 to-amber-700';
    return 'from-slate-800 to-slate-900';
  };

  const getStatusBorder = () => {
    if (lockPenalty.isLocked) return 'border-orange-500/50';
    if (currentWarning) return 'border-red-500/50';
    if (!isConnected) return 'border-amber-500/50';
    return 'border-slate-600/50';
  };

  return (
    <div className="font-sans p-[5px]">
      {/* Violation Counter Bar - Always visible when there are violations */}
      {violationCount > 0 && (
        <div className={`min-h-[28px] flex flex-col px-3 py-1.5 rounded-t-lg ${
          lockPenalty.isLocked ? 'bg-orange-600' : currentWarning ? 'bg-red-600' : 'bg-slate-700'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs text-white font-medium">
                {lockPenalty.isLocked
                  ? `LOCKED ${formatLockTime(lockPenalty.remainingSeconds)}`
                  : 'Violations'}
              </span>
            </div>
            <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded">
              {violationCount}
            </span>
          </div>
          {/* Show current violation message */}
          {currentWarning && (
            <div className="mt-1 text-[10px] text-white/90 truncate">
              {currentWarning.appName
                ? `Attempted: ${currentWarning.appName} - sent to instructor`
                : `${currentWarning.message} - sent to instructor`}
            </div>
          )}
        </div>
      )}

      {/* Main control bar */}
      <div
        className={`h-[60px] w-[310px] flex items-center justify-between px-4 ${violationCount > 0 ? 'rounded-b-xl' : 'rounded-xl'} shadow-2xl border transition-all duration-300 bg-gradient-to-r ${getStatusColor()} ${getStatusBorder()}`}
      >
        {/* Left section - Status */}
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className="relative">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                lockPenalty.isLocked
                  ? 'bg-orange-500/30'
                  : currentWarning
                  ? 'bg-red-500/30'
                  : !isConnected
                  ? 'bg-amber-500/30'
                  : 'bg-emerald-500/20'
              }`}
            >
              {lockPenalty.isLocked ? (
                <svg className="w-5 h-5 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ) : currentWarning ? (
                <svg className="w-5 h-5 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              ) : !isConnected ? (
                <svg className="w-5 h-5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              )}
            </div>
            {/* Pulse animation */}
            <div
              className={`absolute inset-0 rounded-lg animate-ping ${
                lockPenalty.isLocked
                  ? 'bg-orange-500/30'
                  : currentWarning
                  ? 'bg-red-500/30'
                  : isConnected
                  ? 'bg-emerald-500/20'
                  : 'bg-amber-500/30'
              }`}
              style={{ animationDuration: '2s' }}
            />
          </div>

          {/* Time and status text */}
          <div className="flex flex-col">
            <span
              className={`text-lg font-mono font-bold tracking-wide ${
                lockPenalty.isLocked ? 'text-orange-200' : currentWarning ? 'text-red-200' : 'text-white'
              }`}
            >
              {lockPenalty.isLocked ? formatLockTime(lockPenalty.remainingSeconds) : formatTime(elapsedTime)}
            </span>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  lockPenalty.isLocked
                    ? 'bg-orange-400'
                    : currentWarning
                    ? 'bg-red-400'
                    : isConnected
                    ? 'bg-emerald-400'
                    : 'bg-amber-400'
                } animate-pulse`}
              />
              <span className="text-[10px] text-slate-300 uppercase tracking-wide font-medium">
                {lockPenalty.isLocked ? 'Locked' : currentWarning ? 'Alert' : isConnected ? 'Secure' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Right section - Finish button */}
        <button
          onClick={handleFinishExam}
          disabled={isFinishing}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isFinishing ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Ending...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Finish</span>
            </>
          )}
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
