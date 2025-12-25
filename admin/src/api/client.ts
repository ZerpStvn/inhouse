import axios from 'axios';

// Use environment variable for API URL, fallback to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface Admin {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface ExamSession {
  id: string;
  name: string;
  description: string | null;
  allowedUrls: string;
  accessCode: string;
  isActive: boolean;
  startTime: string | null;
  endTime: string | null;
  createdAt: string;
  updatedAt: string;
  adminId: string;
  _count?: {
    attempts: number;
  };
}

export interface ExamAttempt {
  id: string;
  studentName: string | null;
  studentId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  startedAt: string;
  endedAt: string | null;
  status: string;
  violations: string | null;
  sessionId: string;
}

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post('/admin/login', { email, password });
    return response.data;
  },
  register: async (email: string, password: string, name: string) => {
    const response = await api.post('/admin/register', { email, password, name });
    return response.data;
  },
  getProfile: async () => {
    const response = await api.get('/admin/profile');
    return response.data;
  },
};

// Sessions API
export const sessionsApi = {
  getAll: async (): Promise<ExamSession[]> => {
    const response = await api.get('/admin/sessions');
    return response.data;
  },
  getOne: async (id: string): Promise<ExamSession & { attempts: ExamAttempt[] }> => {
    const response = await api.get(`/admin/sessions/${id}`);
    return response.data;
  },
  create: async (data: {
    name: string;
    description?: string;
    allowedUrls: string[];
    startTime?: string;
    endTime?: string;
  }): Promise<ExamSession> => {
    const response = await api.post('/admin/sessions', data);
    return response.data;
  },
  update: async (
    id: string,
    data: Partial<{
      name: string;
      description: string;
      allowedUrls: string[];
      isActive: boolean;
      startTime: string | null;
      endTime: string | null;
    }>
  ): Promise<ExamSession> => {
    const response = await api.put(`/admin/sessions/${id}`, data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/admin/sessions/${id}`);
  },
  regenerateCode: async (id: string): Promise<ExamSession> => {
    const response = await api.post(`/admin/sessions/${id}/regenerate-code`);
    return response.data;
  },
  getAttempts: async (id: string): Promise<ExamAttempt[]> => {
    const response = await api.get(`/admin/sessions/${id}/attempts`);
    return response.data;
  },
  terminateAttempt: async (attemptId: string): Promise<ExamAttempt> => {
    const response = await api.post(`/admin/attempts/${attemptId}/terminate`);
    return response.data;
  },
};

export default api;
