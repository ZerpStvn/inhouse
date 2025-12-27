import { useState } from 'react';
import { SessionInfo } from '../api/client';

interface AgreementModalProps {
  session: SessionInfo;
  onAccept: (studentName: string, studentId: string) => void;
  onDecline: () => void;
}

export default function AgreementModal({
  session,
  onAccept,
  onDecline,
}: AgreementModalProps) {
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<'info' | 'terms'>('info');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (agreed && studentName && studentId) {
      setIsSubmitting(true);
      onAccept(studentName, studentId);
    }
  };

  const canProceed = studentName.trim().length >= 2 && studentId.trim().length >= 1;
  const canSubmit = agreed && canProceed;

  const securityRules = [
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      title: 'Fullscreen Lock',
      description: 'Your screen will be locked in fullscreen mode until the exam is complete.',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
      title: 'App Blocking',
      description: 'All other applications and websites will be blocked during the exam.',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
        </svg>
      ),
      title: 'Keyboard Restrictions',
      description: 'System shortcuts (Alt+Tab, Alt+F4, etc.) will be disabled.',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      title: 'Activity Monitoring',
      description: 'All actions and violations will be logged and reported to your instructor.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onDecline} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="relative px-6 py-5 border-b border-slate-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">{session.name}</h2>
              {session.description && (
                <p className="text-sm text-slate-400 mt-0.5">{session.description}</p>
              )}
            </div>
            <button
              onClick={onDecline}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress indicator */}
          <div className="flex gap-2 mt-4">
            <div className={`h-1 flex-1 rounded-full transition-colors ${currentStep === 'info' ? 'bg-blue-500' : 'bg-slate-600'}`} />
            <div className={`h-1 flex-1 rounded-full transition-colors ${currentStep === 'terms' ? 'bg-blue-500' : 'bg-slate-600'}`} />
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
            {currentStep === 'info' ? (
              /* Step 1: Student Information */
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">Student Information</h3>
                  <p className="text-sm text-slate-400">Enter your details to verify your identity.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="studentName" className="block text-sm font-medium text-slate-300 mb-2">
                      Full Name
                    </label>
                    <input
                      id="studentName"
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="input-field"
                      placeholder="John Doe"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label htmlFor="studentId" className="block text-sm font-medium text-slate-300 mb-2">
                      Student ID
                    </label>
                    <input
                      id="studentId"
                      type="text"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      className="input-field"
                      placeholder="STU-12345"
                      required
                    />
                  </div>
                </div>

                {/* Allowed URLs */}
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <span className="text-sm font-medium text-white">Allowed Resources</span>
                  </div>
                  <div className="space-y-2">
                    {session.allowedUrls.map((url, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-slate-300 font-mono text-xs truncate">{url}</span>
                      </div>
                    ))}
                  </div>
                  {session.endTime && (
                    <div className="mt-4 pt-3 border-t border-slate-700 flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-slate-400">
                        Ends: <span className="text-white">{new Date(session.endTime).toLocaleString()}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Step 2: Security Terms */
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">Security Agreement</h3>
                  <p className="text-sm text-slate-400">Review and accept the exam security terms.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {securityRules.map((rule, i) => (
                    <div
                      key={i}
                      className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center mb-3">
                        {rule.icon}
                      </div>
                      <h4 className="text-sm font-semibold text-white mb-1">{rule.title}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">{rule.description}</p>
                    </div>
                  ))}
                </div>

                {/* Warning */}
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-amber-300">Important</p>
                      <p className="text-xs text-amber-200/70 mt-1">
                        Any attempt to exit, switch applications, or use unauthorized resources will be logged
                        and may result in disciplinary action.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Agreement checkbox */}
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative mt-0.5">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-5 h-5 rounded border-2 border-slate-500 peer-checked:border-blue-500 peer-checked:bg-blue-500 transition-colors flex items-center justify-center">
                      {agreed && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                    I have read and agree to the security terms above. I understand that any violations
                    will be reported to my instructor.
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-700 bg-slate-900/50 flex items-center justify-between">
            {currentStep === 'info' ? (
              <>
                <button
                  type="button"
                  onClick={onDecline}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('terms')}
                  disabled={!canProceed}
                  className="btn-primary flex items-center gap-2"
                >
                  <span>Continue</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentStep('info')}
                  className="btn-secondary flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit || isSubmitting}
                  className="btn-primary flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Starting Exam...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span>Begin Secure Exam</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
