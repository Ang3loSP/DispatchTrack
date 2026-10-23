export type UserRole = 'Admin' | 'Dispatcher' | 'Driver';

export type DriverStatus = 'Available' | 'OnDelivery' | 'Offline';

export type JobStatus = 'Pending' | 'Assigned' | 'InTransit' | 'Delivered' | 'Failed';

export type JobPriority = 'Low' | 'Normal' | 'High' | 'Urgent';

export interface UserProfile {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  driverId?: number | null;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: UserProfile;
}

export interface DriverSummary {
  id: number;
  fullName: string;
  vehicleReg: string;
}

export interface Job {
  id: number;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  status: JobStatus;
  priority: JobPriority;
  notes?: string | null;
  assignedDriver?: DriverSummary | null;
  createdByUserId: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PagedJobs {
  items: Job[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface Driver {
  id: number;
  fullName: string;
  email: string;
  vehicleReg: string;
  currentStatus: DriverStatus;
}

export interface DashboardSummary {
  totalJobs: number;
  jobsByStatus: Record<string, number>;
  jobsCreatedToday: number;
  totalDrivers: number;
  driversByStatus: Record<string, number>;
}

export interface CreateJobInput {
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  priority: JobPriority;
  notes?: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  vehicleReg?: string;
}
