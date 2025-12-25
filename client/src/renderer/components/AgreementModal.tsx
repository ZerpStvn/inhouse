import React, { useState } from 'react';
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (agreed) {
      onAccept(studentName, studentId);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{session.name}</h2>
            {session.description && (
              <p className="text-gray-600 mt-2">{session.description}</p>
            )}
          </div>

          {/* Student Info Form */}
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label
                  htmlFor="studentName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Full Name
                </label>
                <input
                  id="studentName"
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your full name"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="studentId"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Student ID
                </label>
                <input
                  id="studentId"
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your student ID"
                  required
                />
              </div>
            </div>

            {/* Terms */}
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                Exam Security Agreement
              </h3>
              <div className="space-y-3 text-sm text-gray-700">
                <p className="flex items-start">
                  <span className="text-red-500 mr-2">1.</span>
                  Your screen will be locked in fullscreen mode and you will not be able
                  to exit until the exam is complete.
                </p>
                <p className="flex items-start">
                  <span className="text-red-500 mr-2">2.</span>
                  You will only be able to access the approved exam website(s). All
                  other websites and applications will be blocked.
                </p>
                <p className="flex items-start">
                  <span className="text-red-500 mr-2">3.</span>
                  Keyboard shortcuts (Alt+Tab, Alt+F4, etc.) will be disabled during the
                  exam.
                </p>
                <p className="flex items-start">
                  <span className="text-red-500 mr-2">4.</span>
                  Any attempt to use screen recording, virtual machines, or remote
                  desktop software will be detected and reported.
                </p>
                <p className="flex items-start">
                  <span className="text-red-500 mr-2">5.</span>
                  All violations will be logged and reported to your instructor.
                </p>
              </div>
            </div>

            {/* Session Info */}
            <div className="bg-blue-50 rounded-xl p-4 mb-6">
              <h4 className="font-medium text-blue-900 mb-2">Allowed Websites</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                {session.allowedUrls.map((url, i) => (
                  <li key={i} className="flex items-center">
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {url}
                  </li>
                ))}
              </ul>
              {session.endTime && (
                <p className="text-sm text-blue-700 mt-3">
                  <strong>Exam ends:</strong>{' '}
                  {new Date(session.endTime).toLocaleString()}
                </p>
              )}
            </div>

            {/* Agreement Checkbox */}
            <label className="flex items-start mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="ml-3 text-sm text-gray-700">
                I have read and agree to the exam security terms above. I understand
                that any violations will be reported to my instructor and may result in
                disciplinary action.
              </span>
            </label>

            {/* Buttons */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={onDecline}
                className="flex-1 py-3 px-6 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!agreed || !studentName || !studentId}
                className="flex-1 py-3 px-6 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Begin Exam
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
