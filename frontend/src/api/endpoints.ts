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
  TripSheet,
  CreateTripSheetInput,
  AddJobsToTripSheetInput,
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

export const tripSheetApi = {
  getOpen: async (): Promise<TripSheet[]> => {
    const { data } = await api.get<TripSheet[]>('/tripsheets/open');
    return data;
  },
  getById: async (id: number): Promise<TripSheet> => {
    const { data } = await api.get<TripSheet>(`/tripsheets/${id}`);
    return data;
  },
  getByDriver: async (driverId: number): Promise<TripSheet[]> => {
    const { data } = await api.get<TripSheet[]>(`/tripsheets/driver/${driverId}`);
    return data;
  },
  create: async (input: CreateTripSheetInput): Promise<TripSheet> => {
    const { data } = await api.post<TripSheet>('/tripsheets', input);
    return data;
  },
  addJobs: async (id: number, input: AddJobsToTripSheetInput): Promise<TripSheet> => {
    const { data } = await api.post<TripSheet>(`/tripsheets/${id}/jobs`, input);
    return data;
  },
  removeJob: async (tripSheetId: number, jobId: number): Promise<TripSheet> => {
    const { data } = await api.delete<TripSheet>(`/tripsheets/${tripSheetId}/jobs/${jobId}`);
    return data;
  },
  reorderStops: async (id: number, itemIdToStopNumber: Record<number, number>): Promise<TripSheet> => {
    const { data } = await api.patch<TripSheet>(`/tripsheets/${id}/reorder`, itemIdToStopNumber);
    return data;
  },
  depart: async (id: number): Promise<TripSheet> => {
    const { data } = await api.post<TripSheet>(`/tripsheets/${id}/depart`);
    return data;
  },
  returnTrip: async (id: number): Promise<TripSheet> => {
    const { data } = await api.post<TripSheet>(`/tripsheets/${id}/return`);
    return data;
  },
  complete: async (id: number): Promise<TripSheet> => {
    const { data } = await api.post<TripSheet>(`/tripsheets/${id}/complete`);
    return data;
  },
  cancel: async (id: number): Promise<TripSheet> => {
    const { data } = await api.post<TripSheet>(`/tripsheets/${id}/cancel`);
    return data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/tripsheets/${id}`);
  },
  downloadPdf: async (id: number): Promise<Blob> => {
    const { data } = await api.get(`/tripsheets/${id}/pdf`, { responseType: 'blob' });
    return data;
  },
};
