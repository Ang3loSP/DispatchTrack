import * as signalR from '@microsoft/signalr';

export type JobStatusChangedCallback = (jobId: number, status: string, driverName?: string) => void;
export type JobAssignedCallback = (jobId: number, driverId: number, driverName: string) => void;
export type JobCreatedCallback = (jobId: number) => void;
export type CountsChangedCallback = () => void;
export type DriverLocationCallback = (driverId: number, lat: number, lng: number) => void;
export type DriverStatusCallback = (driverId: number, status: string) => void;

class SignalRService {
  private jobHubConnection: signalR.HubConnection | null = null;
  private driverHubConnection: signalR.HubConnection | null = null;
  private baseUrl: string;
  private getToken: () => string | null;

  constructor(baseUrl: string, getToken: () => string | null) {
    this.baseUrl = baseUrl;
    this.getToken = getToken;
  }

  // Job Hub
  async startJobHub(
    onJobStatusChanged?: JobStatusChangedCallback,
    onJobAssigned?: JobAssignedCallback,
    onJobCreated?: JobCreatedCallback,
    onCountsChanged?: CountsChangedCallback
  ) {
    if (this.jobHubConnection?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    const token = this.getToken();
    if (!token) {
      console.warn('SignalR: No auth token available');
      return;
    }

    this.jobHubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.baseUrl}/hubs/jobs`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.jobHubConnection.on('JobStatusChanged', (jobId: number, status: string, driverName?: string) => {
      onJobStatusChanged?.(jobId, status, driverName);
    });

    this.jobHubConnection.on('JobAssigned', (jobId: number, driverId: number, driverName: string) => {
      onJobAssigned?.(jobId, driverId, driverName);
    });

    this.jobHubConnection.on('JobCreated', (jobId: number) => {
      onJobCreated?.(jobId);
    });

    this.jobHubConnection.on('CountsChanged', () => {
      onCountsChanged?.();
    });

    this.jobHubConnection.onclose(() => {
      console.log('SignalR JobHub disconnected');
    });

    try {
      await this.jobHubConnection.start();
      console.log('SignalR JobHub connected');
    } catch (err) {
      console.error('SignalR JobHub connection failed:', err);
    }
  }

  async joinJobGroup(jobId: number) {
    await this.jobHubConnection?.invoke('JoinJobGroup', jobId);
  }

  async leaveJobGroup(jobId: number) {
    await this.jobHubConnection?.invoke('LeaveJobGroup', jobId);
  }

  async joinDispatcherGroup() {
    await this.jobHubConnection?.invoke('JoinDispatcherGroup');
  }

  async leaveDispatcherGroup() {
    await this.jobHubConnection?.invoke('LeaveDispatcherGroup');
  }

  // Driver Hub
  async startDriverHub(
    onDriverLocation?: DriverLocationCallback,
    onDriverStatus?: DriverStatusCallback
  ) {
    if (this.driverHubConnection?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    const token = this.getToken();
    if (!token) {
      console.warn('SignalR: No auth token available');
      return;
    }

    this.driverHubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.baseUrl}/hubs/drivers`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.driverHubConnection.on('DriverLocationUpdated', (driverId: number, lat: number, lng: number) => {
      onDriverLocation?.(driverId, lat, lng);
    });

    this.driverHubConnection.on('DriverStatusUpdated', (driverId: number, status: string) => {
      onDriverStatus?.(driverId, status);
    });

    this.driverHubConnection.on('JobAssigned', (jobId: number) => {
      // Driver received new job assignment - could trigger notification
      console.log('Driver assigned job:', jobId);
    });

    this.driverHubConnection.onclose(() => {
      console.log('SignalR DriverHub disconnected');
    });

    try {
      await this.driverHubConnection.start();
      console.log('SignalR DriverHub connected');
    } catch (err) {
      console.error('SignalR DriverHub connection failed:', err);
    }
  }

  async joinDriverGroup(driverId: number) {
    await this.driverHubConnection?.invoke('JoinDriverGroup', driverId);
  }

  async leaveDriverGroup(driverId: number) {
    await this.driverHubConnection?.invoke('LeaveDriverGroup', driverId);
  }

  async updateLocation(lat: number, lng: number) {
    await this.driverHubConnection?.invoke('UpdateLocation', lat, lng);
  }

  async updateStatus(status: string) {
    await this.driverHubConnection?.invoke('UpdateStatus', status);
  }

  async stop() {
    await this.jobHubConnection?.stop();
    await this.driverHubConnection?.stop();
    this.jobHubConnection = null;
    this.driverHubConnection = null;
  }

  get jobHubState() {
    return this.jobHubConnection?.state ?? signalR.HubConnectionState.Disconnected;
  }

  get driverHubState() {
    return this.driverHubConnection?.state ?? signalR.HubConnectionState.Disconnected;
  }
}

// Singleton instance
let signalRInstance: SignalRService | null = null;

export function initSignalR(baseUrl: string, getToken: () => string | null): SignalRService {
  signalRInstance = new SignalRService(baseUrl, getToken);
  return signalRInstance;
}

export function getSignalR(): SignalRService | null {
  return signalRInstance;
}

export function useSignalR(): SignalRService | null {
  return signalRInstance;
}