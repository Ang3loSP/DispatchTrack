import * as signalR from '@microsoft/signalr';

export type JobStatusChangedCallback = (jobId: number, status: string, driverName?: string) => void;
export type JobAssignedCallback = (jobId: number, driverId: number, driverName: string) => void;
export type JobCreatedCallback = (jobId: number) => void;
export type CountsChangedCallback = () => void;
export type DriverLocationCallback = (driverId: number, lat: number, lng: number) => void;
export type DriverStatusCallback = (driverId: number, status: string) => void;

export type TripSheetCreatedCallback = (tripSheet: TripSheet) => void;
export type TripSheetStatusChangedCallback = (tripSheetId: number, status: number) => void;
export type StopAddedCallback = (tripSheetId: number, item: TripSheetItem) => void;
export type StopRemovedCallback = (tripSheetId: number, itemId: number) => void;
export type StopsReorderedCallback = (tripSheetId: number) => void;

import type { TripSheet, TripSheetItem } from '../types';

class SignalRService {
  private jobHubConnection: signalR.HubConnection | null = null;
  private driverHubConnection: signalR.HubConnection | null = null;
  private tripSheetHubConnection: signalR.HubConnection | null = null;
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
    if (this.jobHubConnection?.state !== signalR.HubConnectionState.Connected) {
      const token = this.getToken();
      if (!token) {
        console.warn('SignalR: No auth token available');
        return;
      }

      this.jobHubConnection = new signalR.HubConnectionBuilder()
        .withUrl(`${this.baseUrl}/hubs/jobs`, {
          accessTokenFactory: () => this.getToken() ?? '',
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      this.jobHubConnection.onclose(() => {
        console.log('SignalR JobHub disconnected');
      });

      try {
        await this.jobHubConnection.start();
        console.log('SignalR JobHub connected');
      } catch (err) {
        console.error('SignalR JobHub connection failed:', err);
        return;
      }
    }

    // The singleton outlives pages, so the mounted page replaces the previous handlers.
    const hub = this.jobHubConnection!;
    hub.off('JobStatusChanged');
    hub.off('JobAssigned');
    hub.off('JobCreated');
    hub.off('CountsChanged');

    hub.on('JobStatusChanged', (jobId: number, status: string, driverName?: string) => {
      onJobStatusChanged?.(jobId, status, driverName);
    });

    hub.on('JobAssigned', (jobId: number, driverId: number, driverName: string) => {
      onJobAssigned?.(jobId, driverId, driverName);
    });

    hub.on('JobCreated', (jobId: number) => {
      onJobCreated?.(jobId);
    });

    hub.on('CountsChanged', () => {
      onCountsChanged?.();
    });
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
    if (this.driverHubConnection?.state !== signalR.HubConnectionState.Connected) {
      const token = this.getToken();
      if (!token) {
        console.warn('SignalR: No auth token available');
        return;
      }

      this.driverHubConnection = new signalR.HubConnectionBuilder()
        .withUrl(`${this.baseUrl}/hubs/drivers`, {
          accessTokenFactory: () => this.getToken() ?? '',
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      this.driverHubConnection.onclose(() => {
        console.log('SignalR DriverHub disconnected');
      });

      try {
        await this.driverHubConnection.start();
        console.log('SignalR DriverHub connected');
      } catch (err) {
        console.error('SignalR DriverHub connection failed:', err);
        return;
      }
    }

    // The singleton outlives pages, so the mounted page replaces the previous handlers.
    const hub = this.driverHubConnection!;
    hub.off('DriverLocationUpdated');
    hub.off('DriverStatusUpdated');
    hub.off('JobAssigned');

    hub.on('DriverLocationUpdated', (driverId: number, lat: number, lng: number) => {
      onDriverLocation?.(driverId, lat, lng);
    });

    hub.on('DriverStatusUpdated', (driverId: number, status: string) => {
      onDriverStatus?.(driverId, status);
    });

    hub.on('JobAssigned', (jobId: number) => {
      // Driver received new job assignment - could trigger notification
      console.log('Driver assigned job:', jobId);
    });
  }

  // TripSheet Hub
  async startTripSheetHub(
    onTripSheetCreated?: TripSheetCreatedCallback,
    onTripSheetStatusChanged?: TripSheetStatusChangedCallback,
    onStopAdded?: StopAddedCallback,
    onStopRemoved?: StopRemovedCallback,
    onStopsReordered?: StopsReorderedCallback
  ) {
    if (this.tripSheetHubConnection?.state !== signalR.HubConnectionState.Connected) {
      const token = this.getToken();
      if (!token) {
        console.warn('SignalR: No auth token available');
        return;
      }

      this.tripSheetHubConnection = new signalR.HubConnectionBuilder()
        .withUrl(`${this.baseUrl}/hubs/tripsheet`, {
          accessTokenFactory: () => this.getToken() ?? '',
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      this.tripSheetHubConnection.onclose(() => {
        console.log('SignalR TripSheetHub disconnected');
      });

      try {
        await this.tripSheetHubConnection.start();
        console.log('SignalR TripSheetHub connected');
      } catch (err) {
        console.error('SignalR TripSheetHub connection failed:', err);
        return;
      }
    }

    // The singleton outlives pages, so the mounted page replaces the previous handlers.
    const hub = this.tripSheetHubConnection!;
    hub.off('TripSheetCreated');
    hub.off('TripSheetStatusChanged');
    hub.off('StopAdded');
    hub.off('StopRemoved');
    hub.off('StopsReordered');

    hub.on('TripSheetCreated', (tripSheet: TripSheet) => {
      onTripSheetCreated?.(tripSheet);
    });

    hub.on('TripSheetStatusChanged', (tripSheetId: number, status: number) => {
      onTripSheetStatusChanged?.(tripSheetId, status);
    });

    hub.on('StopAdded', (tripSheetId: number, item: TripSheetItem) => {
      onStopAdded?.(tripSheetId, item);
    });

    hub.on('StopRemoved', (tripSheetId: number, itemId: number) => {
      onStopRemoved?.(tripSheetId, itemId);
    });

    hub.on('StopsReordered', (tripSheetId: number) => {
      onStopsReordered?.(tripSheetId);
    });
  }

  async joinTripSheetGroup(tripSheetId: number) {
    await this.tripSheetHubConnection?.invoke('JoinTripSheetGroup', tripSheetId);
  }

  async leaveTripSheetGroup(tripSheetId: number) {
    await this.tripSheetHubConnection?.invoke('LeaveTripSheetGroup', tripSheetId);
  }

  async joinDispatchersGroupTripSheet() {
    await this.tripSheetHubConnection?.invoke('JoinDispatchersGroup');
  }

  async leaveDispatchersGroupTripSheet() {
    await this.tripSheetHubConnection?.invoke('LeaveDispatchersGroup');
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
    await this.tripSheetHubConnection?.stop();
    this.jobHubConnection = null;
    this.driverHubConnection = null;
    this.tripSheetHubConnection = null;
  }

  get jobHubState() {
    return this.jobHubConnection?.state ?? signalR.HubConnectionState.Disconnected;
  }

  get driverHubState() {
    return this.driverHubConnection?.state ?? signalR.HubConnectionState.Disconnected;
  }

  get tripSheetHubState() {
    return this.tripSheetHubConnection?.state ?? signalR.HubConnectionState.Disconnected;
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