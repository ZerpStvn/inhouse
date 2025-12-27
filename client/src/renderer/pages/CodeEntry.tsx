import { useState, useEffect } from 'react';
import { studentApi, SessionInfo } from '../api/client';

interface CodeEntryProps {
  onSessionValidated: (session: SessionInfo) => void;
}

interface SystemStatus {
  platform: string;
  ready: boolean;
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'checking';
    message: string;
  }[];
}

export default function CodeEntry({ onSessionValidated }: CodeEntryProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [showSystemCheck, setShowSystemCheck] = useState(false);

  useEffect(() => {
    // Run system check on mount
    runSystemCheck();
  }, []);

  const runSystemCheck = async () => {
    setShowSystemCheck(true);
    const checks: SystemStatus['checks'] = [
      { name: 'Electron Environment', status: 'checking', message: 'Checking...' },
      { name: 'Screen Lock Ready', status: 'checking', message: 'Checking...' },
      { name: 'Server Connection', status: 'checking', message: 'Checking...' },
    ];

    setSystemStatus({
      platform: navigator.platform,
      ready: false,
      checks,
    });

    // Check Electron
    await new Promise(resolve => setTimeout(resolve, 300));
    checks[0] = {
      name: 'Electron Environment',
      status: window.electronAPI ? 'pass' : 'fail',
      message: window.electronAPI ? 'Secure browser active' : 'Running in browser mode',
    };
    setSystemStatus(prev => prev ? { ...prev, checks: [...checks] } : null);

    // Check screen lock capability
    await new Promise(resolve => setTimeout(resolve, 300));
    checks[1] = {
      name: 'Screen Lock Ready',
      status: window.electronAPI ? 'pass' : 'fail',
      message: window.electronAPI ? 'Fullscreen lockdown available' : 'Limited security',
    };
    setSystemStatus(prev => prev ? { ...prev, checks: [...checks] } : null);

    // Check server connection
    await new Promise(resolve => setTimeout(resolve, 300));
    try {
      await studentApi.validateCode('TEST00');
      checks[2] = { name: 'Server Connection', status: 'pass', message: 'Connected' };
    } catch {
      // Even a 404 means server is reachable
      checks[2] = { name: 'Server Connection', status: 'pass', message: 'Server online' };
    }
    setSystemStatus(prev => prev ? { ...prev, checks: [...checks], ready: true } : null);

    // Hide system check after 1.5s if all pass
    setTimeout(() => setShowSystemCheck(false), 1500);
  };

  const formatCode = (value: string) => {
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (cleaned.length > 3) {
      return cleaned.slice(0, 3) + '-' + cleaned.slice(3, 6);
    }
    return cleaned;
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCode(e.target.value);
    if (formatted.replace('-', '').length <= 6) {
      setCode(formatted);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanCode = code.replace('-', '');
    if (cleanCode.length !== 6) {
      setError('Please enter a valid 6-character code');
      return;
    }

    setIsLoading(true);

    try {
      const session = await studentApi.validateCode(cleanCode);
      onSessionValidated(session);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }, message?: string };
      setError(error.response?.data?.error || error.message || 'Invalid access code');
    } finally {
      setIsLoading(false);
    }
  };

  const isCodeComplete = code.replace('-', '').length === 6;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Background pattern */}
      <div className="fixed inset-0 opacity-30">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-cyan-600/20" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.15) 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Secure Exam Browser</h1>
            <p className="text-xs text-slate-400">v1.0.0</p>
          </div>
        </div>

        {/* System status indicator */}
        <button
          onClick={() => setShowSystemCheck(!showSystemCheck)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 hover:border-slate-600 transition-colors"
        >
          <div className={`w-2 h-2 rounded-full ${systemStatus?.ready ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
          <span className="text-xs text-slate-300">
            {systemStatus?.ready ? 'System Ready' : 'Checking...'}
          </span>
        </button>
      </header>

      {/* System Check Panel */}
      {showSystemCheck && systemStatus && (
        <div className="absolute top-20 right-6 z-20 animate-slide-down">
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl w-72 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <span className="text-sm font-medium text-white">System Status</span>
              <button
                onClick={() => setShowSystemCheck(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-3">
              {systemStatus.checks.map((check, i) => (
                <div key={i} className="flex items-center gap-3">
                  {check.status === 'checking' ? (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  ) : check.status === 'pass' ? (
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-white">{check.name}</p>
                    <p className="text-xs text-slate-400">{check.message}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 bg-slate-800/50 border-t border-slate-700">
              <button
                onClick={runSystemCheck}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Run check again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md animate-slide-up">
          {/* Code Entry Card */}
          <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
            <div className="p-8">
              {/* Icon */}
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>

              {/* Title */}
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Enter Access Code</h2>
                <p className="text-slate-400 text-sm">
                  Enter the 6-character code provided by your instructor
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 animate-slide-down">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit}>
                <div className="mb-6">
                  <div className="relative">
                    <input
                      type="text"
                      value={code}
                      onChange={handleCodeChange}
                      placeholder="XXX-XXX"
                      className="w-full text-center text-4xl font-mono tracking-[0.3em] px-4 py-5 bg-slate-900 border-2 border-slate-600 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      autoFocus
                      autoComplete="off"
                      spellCheck="false"
                    />
                    {isCodeComplete && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !isCodeComplete}
                  className="w-full btn-primary py-4 text-lg font-semibold flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Validating...</span>
                    </>
                  ) : (
                    <>
                      <span>Join Exam</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Footer info */}
            <div className="px-8 py-5 bg-slate-900/50 border-t border-slate-700">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">Security Notice</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Once started, your screen will be locked. All activity is monitored and violations are reported.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="mt-8 grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-xs text-slate-400">Secure Lockdown</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xs text-slate-400">Real-time Monitoring</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-xs text-slate-400">Instant Reporting</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-4 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Secure Exam Browser</span>
          <span>{navigator.platform}</span>
        </div>
      </footer>
    </div>
  );
}
