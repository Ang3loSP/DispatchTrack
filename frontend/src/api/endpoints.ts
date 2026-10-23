import { api } from './client';
import type {
  AuthResponse,
  UserProfile,
  PagedJobs,
  Job,
  CreateJobInput,
  Driver,
  DashboardSummary,
  CreateUserInput,
  JobStatus,
} from '../types';

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    return data;
  },
  refresh: async (): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/refresh');
    return data;
  },
  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },
  me: async (): Promise<UserProfile> => {
    const { data } = await api.get<UserProfile>('/auth/me');
    return data;
  },
};

export const jobsApi = {
  getJobs: async (params?: { status?: string; page?: number; pageSize?: number }): Promise<PagedJobs> => {
    const { data } = await api.get<PagedJobs>('/jobs', { params });
    return data;
  },
  getJob: async (id: number): Promise<Job> => {
    const { data } = await api.get<Job>(`/jobs/${id}`);
    return data;
  },
  createJob: async (input: CreateJobInput): Promise<Job> => {
    const { data } = await api.post<Job>('/jobs', input);
    return data;
  },
  assignJob: async (id: number, driverId: number): Promise<Job> => {
    const { data } = await api.patch<Job>(`/jobs/${id}/assign`, { driverId });
    return data;
  },
  updateJobStatus: async (id: number, status: JobStatus): Promise<Job> => {
    const { data } = await api.patch<Job>(`/jobs/${id}/status`, { status });
    return data;
  },
};

export const driversApi = {
  getDrivers: async (): Promise<Driver[]> => {
    const { data } = await api.get<Driver[]>('/drivers');
    return data;
  },
  getMyJobs: async (): Promise<Job[]> => {
    const { data } = await api.get<Job[]>('/drivers/me/jobs');
    return data;
  },
};

export const dashboardApi = {
  getSummary: async (): Promise<DashboardSummary> => {
    const { data } = await api.get<DashboardSummary>('/dashboard/summary');
    return data;
  },
};

export const usersApi = {
  createUser: async (input: CreateUserInput): Promise<UserProfile> => {
    const { data } = await api.post<UserProfile>('/users', input);
    return data;
  },
};

export const demoApi = {
  resetDemo: async (): Promise<{ message: string }> => {
    const { data } = await api.post<{ message: string }>('/demo/reset');
    return data;
  },
};
