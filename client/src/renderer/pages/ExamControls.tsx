import React, { useState, useEffect } from 'react';
import { studentApi } from '../api/client';

export default function ExamControls() {
  const [showAdminExit, setShowAdminExit] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [attemptId, setAttemptId] = useState<string | null>(null);

  useEffect(() => {
    const loadAttemptId = async () => {
      if (window.electronAPI) {
        const id = await window.electronAPI.getAttemptId();
        setAttemptId(id);
      }
    };
    loadAttemptId();
  }, []);

  const handleSubmitExam = async () => {
    if (confirm('Are you sure you want to submit your exam? This action cannot be undone.')) {
      try {
        if (attemptId) {
          await studentApi.endAttempt(attemptId, 'completed');
        }
        if (window.electronAPI) {
          await window.electronAPI.endExam();
        }
      } catch (error) {
        console.error('Failed to end exam:', error);
      }
    }
  };

  const handleAdminExit = async () => {
    if (!window.electronAPI) return;

    setAdminError('');
    const result = await window.electronAPI.adminExit(adminPassword);

    if (result.success) {
      if (attemptId) {
        await studentApi.endAttempt(attemptId, 'admin_terminated');
      }
    } else {
      setAdminError(result.error || 'Invalid password');
    }
  };

  return (
    <div className="h-[60px] w-[300px] bg-gray-900 flex items-center justify-between px-4 rounded-lg shadow-2xl border border-gray-700">
      <div className="flex items-center space-x-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-white text-sm font-medium">Exam in Progress</span>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={handleSubmitExam}
          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
        >
          Submit
        </button>
        <button
          onClick={() => setShowAdminExit(true)}
          className="text-gray-400 hover:text-white text-xs"
        >
          Exit
        </button>
      </div>

      {showAdminExit && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Exit</h3>
            <p className="text-sm text-gray-600 mb-4">Enter the admin password to exit.</p>
            {adminError && (
              <div className="bg-red-50 text-red-600 p-2 rounded mb-4 text-sm">{adminError}</div>
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
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
