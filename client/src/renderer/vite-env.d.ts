/// <reference types="vite/client" />

declare global {
  interface Window {
    electronAPI?: {
      startExam: (data: { urls: string[]; attemptId: string }) => Promise<{ success: boolean }>;
      endExam: () => Promise<{ success: boolean }>;
      getAllowedUrls: () => Promise<string[]>;
      getAttemptId: () => Promise<string | null>;
      adminExit: (password: string) => Promise<{ success: boolean; error?: string }>;
      onReportViolation: (
        callback: (data: {
          attemptId: string;
          violation: { type: string; description: string; details?: string };
        }) => void
      ) => () => void;
    };
  }
}

export {};
