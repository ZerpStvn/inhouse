import axios from 'axios';

// Use environment variable for API URL, fallback to localhost for development
// In production, this will be set during build or via electron-store
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface SessionInfo {
  sessionId: string;
  name: string;
  description: string | null;
  allowedUrls: string[];
  startTime: string | null;
  endTime: string | null;
}

export interface AttemptInfo {
  attemptId: string;
  sessionId: string;
  sessionName: string;
  allowedUrls: string[];
  startedAt: string;
  endTime: string | null;
}

export const studentApi = {
  validateCode: async (code: string): Promise<SessionInfo> => {
    const response = await api.post('/student/validate-code', { code });
    return response.data;
  },

  startAttempt: async (data: {
    sessionId: string;
    studentName?: string;
    studentId?: string;
  }): Promise<AttemptInfo> => {
    const response = await api.post('/student/start-attempt', data);
    return response.data;
  },

  reportViolation: async (data: {
    attemptId: string;
    violation: {
      type: string;
      description: string;
      details?: string;
    };
  }): Promise<void> => {
    await api.post('/student/report-violation', data);
  },

  endAttempt: async (attemptId: string, reason: string): Promise<void> => {
    await api.post('/student/end-attempt', { attemptId, reason });
  },

  checkStatus: async (attemptId: string): Promise<{
    status: string;
    shouldTerminate: boolean;
    endTime: string | null;
  }> => {
    const response = await api.get(`/student/attempt/${attemptId}/status`);
    return response.data;
  },
};

export default api;
