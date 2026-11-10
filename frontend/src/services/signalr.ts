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

  // TripSheet Hub
  async startTripSheetHub(
    onTripSheetCreated?: TripSheetCreatedCallback,
    onTripSheetStatusChanged?: TripSheetStatusChangedCallback,
    onStopAdded?: StopAddedCallback,
    onStopRemoved?: StopRemovedCallback,
    onStopsReordered?: StopsReorderedCallback
  ) {
    if (this.tripSheetHubConnection?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    const token = this.getToken();
    if (!token) {
      console.warn('SignalR: No auth token available');
      return;
    }

    this.tripSheetHubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.baseUrl}/hubs/tripsheet`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.tripSheetHubConnection.on('TripSheetCreated', (tripSheet: TripSheet) => {
      onTripSheetCreated?.(tripSheet);
    });

    this.tripSheetHubConnection.on('TripSheetStatusChanged', (tripSheetId: number, status: number) => {
      onTripSheetStatusChanged?.(tripSheetId, status);
    });

    this.tripSheetHubConnection.on('StopAdded', (tripSheetId: number, item: TripSheetItem) => {
      onStopAdded?.(tripSheetId, item);
    });

    this.tripSheetHubConnection.on('StopRemoved', (tripSheetId: number, itemId: number) => {
      onStopRemoved?.(tripSheetId, itemId);
    });

    this.tripSheetHubConnection.on('StopsReordered', (tripSheetId: number) => {
      onStopsReordered?.(tripSheetId);
    });

    this.tripSheetHubConnection.onclose(() => {
      console.log('SignalR TripSheetHub disconnected');
    });

    try {
      await this.tripSheetHubConnection.start();
      console.log('SignalR TripSheetHub connected');
    } catch (err) {
      console.error('SignalR TripSheetHub connection failed:', err);
    }
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