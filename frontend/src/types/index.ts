export type UserRole = 'Admin' | 'Dispatcher' | 'Driver';

export type DriverStatus = 'Available' | 'OnRoute' | 'Offline';

export type JobStatus = 'Pending' | 'Assigned' | 'InTransit' | 'Delivered' | 'Failed';

export type JobPriority = 'Low' | 'Normal' | 'High';

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

export type TripSheetStatus = 0 | 1 | 2 | 3 | 4; // Created, InProgress, Returned, Complete, Cancelled

export interface TripSheetItem {
  tripSheetItemId: number;
  tripSheetId: number;
  jobId: number;
  stopNumber: number;
  nonCustomerDestinationId?: number | null;
  nonTicketCustomerId?: number | null;
  nonTicketDescription?: string | null;
  createdAt: string;
  job?: Job;
}

export interface TripSheet {
  tripSheetId: number;
  tripNumber: string;
  status: TripSheetStatus;
  dispatchDestinationCategory?: string | null;
  driverId: number;
  driverName: string;
  tripStartDateTime?: string | null;
  tripEndDateTime?: string | null;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
  items: TripSheetItem[];
}

export interface CreateTripSheetInput {
  tripNumber: string;
  driverId: number;
  driverName: string;
  category?: string;
  createdByUserId: number;
  jobIds: number[];
}

export interface AddJobsToTripSheetInput {
  jobIds: number[];
}
