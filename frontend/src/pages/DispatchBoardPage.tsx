import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi, driversApi, tripSheetApi } from '../api/endpoints';
import type { Job, TripSheet, JobStatus } from '../types';
import { Card } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Search, GripVertical, Truck, ArrowRight, X } from 'lucide-react';
import { getSignalR } from '../services/signalr';
import { cn } from '../utils/cn';

const STATUS_FILTERS = ['All', 'Pending', 'Assigned', 'InTransit', 'Delivered', 'Failed'] as const;

export const DispatchBoardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'All' | JobStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [tripNumber, setTripNumber] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<number[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [tripSheetToView, setTripSheetToView] = useState<TripSheet | null>(null);

  const { data: openTripSheets } = useQuery({
    queryKey: ['tripSheets', 'open'],
    queryFn: tripSheetApi.getOpen,
  });

  const { data: drivers } = useQuery({
    queryKey: ['drivers', 'available'],
    queryFn: driversApi.getDrivers,
  });

  const { data: jobs, isLoading: isLoadingJobs } = useQuery({
    queryKey: ['jobs', 'dispatch-queue'],
    queryFn: () => jobsApi.getJobs({ status: 'Pending', page: 1, pageSize: 50 }),
  });

  // SignalR real-time updates
  useEffect(() => {
    const signalR = getSignalR();
    if (!signalR) return;

    const setupSignalR = async () => {
      await signalR.startTripSheetHub(
        // onTripSheetCreated
        (tripSheet) => {
          console.log('TripSheet created:', tripSheet);
          queryClient.invalidateQueries({ queryKey: ['tripSheets', 'open'] });
          queryClient.invalidateQueries({ queryKey: ['jobs', 'dispatch-queue'] });
        },
        // onTripSheetStatusChanged
        (_tripSheetId, _status) => {
          queryClient.invalidateQueries({ queryKey: ['tripSheets', 'open'] });
        },
        // onStopAdded
        (_tripSheetId) => {
          queryClient.invalidateQueries({ queryKey: ['tripSheets', 'open'] });
        },
        // onStopRemoved
        (_tripSheetId) => {
          queryClient.invalidateQueries({ queryKey: ['tripSheets', 'open'] });
        },
        // onStopsReordered
        (_tripSheetId) => {
          queryClient.invalidateQueries({ queryKey: ['tripSheets', 'open'] });
        }
      );

      await signalR.joinDispatchersGroupTripSheet();
    };

    setupSignalR();

    return () => {
      signalR.leaveDispatchersGroupTripSheet();
    };
  }, [queryClient]);

  const availableDrivers = drivers?.filter(d => d.currentStatus === 'Available') || [];
  const pendingJobs = jobs?.items.filter(job => {
    const matchesStatus = statusFilter === 'All' || job.status === statusFilter;
    const matchesSearch = job.pickupAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.dropoffAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.id.toString().includes(searchQuery);
    return matchesStatus && matchesSearch;
  }) || [];

  const handleJobSelect = (jobId: number, checked: boolean) => {
    setSelectedJobIds(prev => checked ? [...prev, jobId] : prev.filter(id => id !== jobId));
  };

  const createTripSheetMutation = useMutation({
    mutationFn: () => tripSheetApi.create({
      tripNumber: tripNumber,
      driverId: selectedDriverId!,
      driverName: availableDrivers.find(d => d.id === selectedDriverId)?.fullName || '',
      category: 'Local',
      createdByUserId: 1, // TODO: get from auth context
      jobIds: selectedJobIds,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tripSheets', 'open'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', 'dispatch-queue'] });
      setTripNumber('');
      setSelectedDriverId(null);
      setSelectedJobIds([]);
      setIsCreating(false);
    },
    onError: (error) => {
      console.error('Failed to create trip sheet:', error);
      alert('Failed to create trip sheet. Please try again.');
    },
  });

  const handleCreateTripSheet = () => {
    if (!tripNumber.trim() || !selectedDriverId || selectedJobIds.length === 0) {
      alert('Please fill in trip number, select a driver, and select at least one job.');
      return;
    }
    setIsCreating(true);
    createTripSheetMutation.mutate();
  };

  const openTripSheetDetail = (tripSheet: TripSheet) => {
    setTripSheetToView(tripSheet);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-main)]">Dispatch Board</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Plan routes • Group jobs into trip sheets • Assign drivers</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['jobs', 'dispatch-queue'] })}
            disabled={isLoadingJobs}
          >
            <Search className="h-4 w-4 mr-1.5 animate-spin" />
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* Main Layout: Queue (Left) + Trip Sheets (Right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Dispatch Queue */}
        <div className="w-3/5 border-r border-[var(--border-hairline)] flex flex-col overflow-hidden bg-[var(--bg-page)]">
          {/* Queue Header */}
          <div className="p-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text-main)]">
                Dispatch Queue ({pendingJobs.length} jobs)
              </h2>
              {selectedJobIds.length > 0 && (
                <span className="text-xs text-[var(--text-muted)]">{selectedJobIds.length} selected</span>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Search pickup/dropoff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[150px]"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'All' | JobStatus)}
                className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 py-1 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--color-accent)]"
              >
                {STATUS_FILTERS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Job List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoadingJobs ? (
              <div className="space-y-2">
                <Skeleton variant="card" />
                <Skeleton variant="card" />
                <Skeleton variant="card" />
              </div>
            ) : pendingJobs.length === 0 ? (
              <EmptyState
                message="No pending jobs in queue"
                description="Jobs with Pending status will appear here for dispatch."
              />
            ) : (
              pendingJobs.map(job => (
                <DraggableJobCard
                  key={job.id}
                  job={job}
                  isSelected={selectedJobIds.includes(job.id)}
                  onSelect={handleJobSelect}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('jobId', job.id.toString());
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                />
              ))
            )}
          </div>

          {/* Create Trip Sheet Footer */}
          <div className="p-3 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                placeholder="Trip Number (e.g., TS-2024-001)"
                value={tripNumber}
                onChange={(e) => setTripNumber(e.target.value)}
                disabled={isCreating}
              />
              <select
                value={selectedDriverId || ''}
                onChange={(e) => setSelectedDriverId(e.target.value ? Number(e.target.value) : null)}
                disabled={isCreating || availableDrivers.length === 0}
                className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 py-1.5 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--color-accent)]"
              >
                <option value="">Select Driver</option>
                {availableDrivers.map(driver => (
                  <option key={driver.id} value={driver.id}>
                    {driver.fullName} ({driver.vehicleReg})
                  </option>
                ))}
              </select>
              <div className="flex items-center justify-end">
                <Button
                  variant={selectedJobIds.length === 0 ? 'outline' : 'primary'}
                  size="lg"
                  disabled={isCreating || !tripNumber.trim() || !selectedDriverId || selectedJobIds.length === 0}
                  onClick={handleCreateTripSheet}
                  isLoading={isCreating}
                >
                  {isCreating ? 'Creating...' : `Create Trip Sheet (${selectedJobIds.length} jobs)`}
                </Button>
              </div>
            </div>
            <p className="text-xs text-[var(--text-muted)] text-center">
              Drag jobs from the queue to a trip sheet on the right, or select multiple and create a new trip sheet.
            </p>
          </div>
        </div>

        {/* Right: Open Trip Sheets */}
        <div className="w-2/5 flex flex-col overflow-hidden bg-[var(--bg-surface)]">
          <div className="p-3 border-b border-[var(--border-hairline)]">
            <h2 className="text-sm font-semibold text-[var(--text-main)] flex items-center justify-between">
              Open Trip Sheets ({openTripSheets?.length || 0})
              <span className="text-xs text-[var(--text-muted)]">Drop jobs here</span>
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {openTripSheets?.length === 0 ? (
              <EmptyState
                message="No open trip sheets"
                description="Create a new trip sheet from the queue on the left."
                className="h-full flex flex-col justify-center"
              />
            ) : (
              openTripSheets?.map(tripSheet => (
                <TripSheetDropZone
                  key={tripSheet.tripSheetId}
                  tripSheet={tripSheet}
                  onView={openTripSheetDetail}
                  onDrop={() => {
                    // In a real implementation, this would call tripSheetApi.addJobs
                    // For now, we just invalidate queries
                    queryClient.invalidateQueries({ queryKey: ['tripSheets', 'open'] });
                    queryClient.invalidateQueries({ queryKey: ['jobs', 'dispatch-queue'] });
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Trip Sheet Detail Modal */}
      {tripSheetToView && (
        <TripSheetDetailModal
          tripSheet={tripSheetToView}
          onClose={() => setTripSheetToView(null)}
        />
      )}
    </div>
  );
};

// Draggable Job Card Component
interface DraggableJobCardProps {
  job: Job;
  isSelected: boolean;
  onSelect: (jobId: number, checked: boolean) => void;
  onDragStart: (e: React.DragEvent) => void;
}

const DraggableJobCard: React.FC<DraggableJobCardProps> = ({ job, isSelected, onSelect, onDragStart }) => (
  <div
    draggable
    onDragStart={onDragStart}
    onClick={() => onSelect(job.id, !isSelected)}
    className={cn(
      'p-3 rounded-md border cursor-pointer transition-all',
      isSelected
        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5 ring-1 ring-[var(--color-accent)]'
        : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--color-accent)]',
      'shadow-xs'
    )}
  >
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => onSelect(job.id, e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-[var(--border-hairline)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
      />
      <GripVertical className="h-5 w-5 text-[var(--text-muted)] cursor-grab active:cursor-grabbing shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-sm text-[var(--text-main)] tabular-nums">Job #{job.id}</span>
          <div className="flex items-center gap-1.5">
            <StatusBadge status={job.priority} size="sm" />
            <StatusBadge status={job.status} size="sm" />
          </div>
        </div>
        <div className="mt-1 space-y-1 text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-1">
            <Truck className="h-3.5 w-3.5 text-emerald-500" />
            <span className="truncate">{job.pickupAddress}</span>
          </div>
          <div className="flex items-center gap-1">
            <ArrowRight className="h-3.5 w-3.5 text-rose-500" />
            <span className="truncate">{job.dropoffAddress}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Trip Sheet Drop Zone Component
interface TripSheetDropZoneProps {
  tripSheet: TripSheet;
  onView: (tripSheet: TripSheet) => void;
  onDrop: (jobId: number) => void;
}

const TripSheetDropZone: React.FC<TripSheetDropZoneProps> = ({ tripSheet, onView, onDrop }) => {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const jobId = Number(e.dataTransfer.getData('jobId'));
    if (jobId) onDrop(jobId);
  };

  const statusLabels = ['Created', 'InProgress', 'Returned', 'Complete', 'Cancelled'];

  return (
    <Card
      className={cn(
        'p-3 border-l-4 transition-colors',
        dragOver ? 'border-l-[var(--color-accent)] bg-[var(--color-accent)]/5' : 'border-l-[var(--border-hairline)]'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-[var(--text-main)]">{tripSheet.tripNumber}</span>
          <StatusBadge status={statusLabels[tripSheet.status] as any} size="sm" />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(tripSheet)}
          className="text-xs"
        >
          View
        </Button>
      </div>

      <div className="space-y-1 text-xs text-[var(--text-muted)] mb-2">
        <div className="flex items-center gap-1">
          <Truck className="h-3.5 w-3.5" />
          <span>{tripSheet.driverName}</span>
        </div>
        {tripSheet.dispatchDestinationCategory && (
          <div className="flex items-center gap-1">
            <span>Category:</span>
            <span className="font-medium">{tripSheet.dispatchDestinationCategory}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <span>Stops:</span>
          <span className="font-medium">{tripSheet.items?.length || 0}</span>
        </div>
      </div>

      {tripSheet.items && tripSheet.items.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {tripSheet.items
            .sort((a, b) => a.stopNumber - b.stopNumber)
            .map(item => (
              <div
                key={item.tripSheetItemId}
                className="flex items-center justify-between p-2 rounded bg-[var(--bg-page)] text-xs border border-[var(--border-hairline)]"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-[var(--text-main)] w-6">{item.stopNumber}.</span>
                  <span className="truncate max-w-[200px]">{item.job?.pickupAddress || 'Loading...'}</span>
                </div>
                <span className="text-[var(--text-muted)]">→ {item.job?.dropoffAddress || ''}</span>
              </div>
            ))}
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between text-[10px] text-[var(--text-muted)]">
        <span>Drag jobs here to add</span>
        <span>Created: {new Date(tripSheet.createdAt).toLocaleString()}</span>
      </div>
    </Card>
  );
};

// Trip Sheet Detail Modal
interface TripSheetDetailModalProps {
  tripSheet: TripSheet;
  onClose: () => void;
}

const TripSheetDetailModal: React.FC<TripSheetDetailModalProps> = ({ tripSheet, onClose }) => {
  const statusLabels = ['Created', 'InProgress', 'Returned', 'Complete', 'Cancelled'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-3xl max-h-[90vh] bg-[var(--bg-surface)] rounded-lg border border-[var(--border-hairline)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-hairline)]">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-main)]">{tripSheet.tripNumber}</h2>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <StatusBadge status={statusLabels[tripSheet.status] as any} size="sm" />
              <span className="text-[var(--text-muted)]">{tripSheet.driverName} • {tripSheet.items?.length || 0} stops</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Trip Info */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-[var(--text-main)] mb-3">Trip Information</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[var(--text-muted)]">Trip Number</span>
                <p className="font-medium text-[var(--text-main)]">{tripSheet.tripNumber}</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Status</span>
                <p className="font-medium text-[var(--text-main)]">{statusLabels[tripSheet.status]}</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Driver</span>
                <p className="font-medium text-[var(--text-main)]">{tripSheet.driverName}</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Category</span>
                <p className="font-medium text-[var(--text-main)]">{tripSheet.dispatchDestinationCategory || 'N/A'}</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Start Time</span>
                <p className="font-medium text-[var(--text-main)]">{tripSheet.tripStartDateTime ? new Date(tripSheet.tripStartDateTime).toLocaleString() : 'Not started'}</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">End Time</span>
                <p className="font-medium text-[var(--text-main)]">{tripSheet.tripEndDateTime ? new Date(tripSheet.tripEndDateTime).toLocaleString() : 'Not ended'}</p>
              </div>
            </div>
          </Card>

          {/* Stops */}
          <Card>
            <div className="p-4 border-b border-[var(--border-hairline)]">
              <h3 className="text-sm font-semibold text-[var(--text-main)]">Stops ({tripSheet.items?.length || 0})</h3>
            </div>
            <div className="divide-y divide-[var(--border-hairline)]">
              {tripSheet.items?.sort((a, b) => a.stopNumber - b.stopNumber).map(item => (
                <div key={item.tripSheetItemId} className="p-4 flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center text-[var(--color-accent)] font-bold text-sm">
                    {item.stopNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[var(--text-muted)]">Pickup:</span>
                      <span className="font-medium text-[var(--text-main)] truncate">{item.job?.pickupAddress}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs mt-0.5">
                      <span className="text-[var(--text-muted)]">Dropoff:</span>
                      <span className="font-medium text-[var(--text-main)] truncate">{item.job?.dropoffAddress}</span>
                    </div>
                    {item.nonTicketDescription && (
                      <div className="text-xs text-[var(--text-muted)] mt-1">{item.nonTicketDescription}</div>
                    )}
                  </div>
                  {item.job && (
                    <StatusBadge status={item.job.status} size="sm" />
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--border-hairline)]">
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            <Button variant="primary" size="sm" onClick={() => { /* Print logic */ }}>Print Manifest</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DispatchBoardPage;