import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { jobsApi, driversApi } from '../api/endpoints';
import type { Job, JobStatus, JobPriority, CreateJobInput } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Drawer } from '../components/ui/Drawer';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import {
  Plus,
  Search,
  Filter,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import axios from 'axios';

const STATUS_FILTERS: (JobStatus | 'All')[] = [
  'All',
  'Pending',
  'Assigned',
  'InTransit',
  'Delivered',
  'Failed',
];

export const JobsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state
  const statusFilter = (searchParams.get('status') as JobStatus | 'All') || 'All';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const selectedJobIdParam = searchParams.get('jobId');
  const isCreateOpenParam = searchParams.get('create') === 'true';

  const selectedJobId = selectedJobIdParam ? parseInt(selectedJobIdParam, 10) : null;

  const [searchQuery, setSearchQuery] = useState('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<number | ''>('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Create Job Form State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(isCreateOpenParam);
  const [newPickup, setNewPickup] = useState('');
  const [newDropoff, setNewDropoff] = useState('');
  const [newPriority, setNewPriority] = useState<JobPriority>('Normal');
  const [newNotes, setNewNotes] = useState('');

  // Fetch Jobs
  const { data: pagedJobs, isLoading, isFetching } = useQuery({
    queryKey: ['jobs', statusFilter, pageParam],
    queryFn: () =>
      jobsApi.getJobs({
        status: statusFilter === 'All' ? undefined : statusFilter,
        page: pageParam,
        pageSize: 10,
      }),
  });

  // Fetch Single Job Detail for Drawer
  const { data: jobDetail } = useQuery({
    queryKey: ['jobDetail', selectedJobId],
    queryFn: () => (selectedJobId ? jobsApi.getJob(selectedJobId) : null),
    enabled: !!selectedJobId,
  });

  const selectedJob: Job | null =
    jobDetail ||
    (pagedJobs?.items && selectedJobId
      ? pagedJobs.items.find((j) => j.id === selectedJobId) || null
      : null);

  // Fetch Drivers for assignment
  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: driversApi.getDrivers,
  });

  // Mutations
  const createJobMutation = useMutation({
    mutationFn: (input: CreateJobInput) => jobsApi.createJob(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setIsCreateModalOpen(false);
      setNewPickup('');
      setNewDropoff('');
      setNewNotes('');
      setSearchParams((prev) => {
        prev.delete('create');
        return prev;
      });
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err)) {
        setActionError(err.response?.data?.detail || 'Failed to create job.');
      }
    },
  });

  const assignJobMutation = useMutation({
    mutationFn: ({ jobId, driverId }: { jobId: number; driverId: number }) =>
      jobsApi.assignJob(jobId, driverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobDetail', selectedJobId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setIsAssignModalOpen(false);
      setActionError(null);
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err)) {
        setActionError(err.response?.data?.detail || 'Assignment rejected.');
      }
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ jobId, status }: { jobId: number; status: JobStatus }) =>
      jobsApi.updateJobStatus(jobId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobDetail', selectedJobId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setActionError(null);
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err)) {
        setActionError(err.response?.data?.detail || 'Status transition rejected.');
      }
    },
  });

  const handleFilterChange = (newStatus: JobStatus | 'All') => {
    setSearchParams((prev) => {
      if (newStatus === 'All') prev.delete('status');
      else prev.set('status', newStatus);
      prev.set('page', '1');
      return prev;
    });
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams((prev) => {
      prev.set('page', newPage.toString());
      return prev;
    });
  };

  const openJobDetail = (job: Job) => {
    setActionError(null);
    setSearchParams((prev) => {
      prev.set('jobId', job.id.toString());
      return prev;
    });
  };

  const closeJobDetail = () => {
    setActionError(null);
    setSearchParams((prev) => {
      prev.delete('jobId');
      return prev;
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPickup || !newDropoff) return;

    createJobMutation.mutate({
      pickupAddress: newPickup,
      pickupLat: -26.2041, // default Cape Town / Johannesburg seed coords
      pickupLng: 28.0473,
      dropoffAddress: newDropoff,
      dropoffLat: -26.1952,
      dropoffLng: 28.0345,
      priority: newPriority,
      notes: newNotes || undefined,
    });
  };

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob || selectedDriverId === '') return;
    assignJobMutation.mutate({ jobId: selectedJob.id, driverId: Number(selectedDriverId) });
  };

  // Filter items locally by search query if typed
  const filteredJobs = pagedJobs?.items?.filter((j) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      j.id.toString().includes(q) ||
      j.pickupAddress.toLowerCase().includes(q) ||
      j.dropoffAddress.toLowerCase().includes(q) ||
      (j.assignedDriver && j.assignedDriver.fullName.toLowerCase().includes(q))
    );
  });

  const totalPages = pagedJobs ? Math.ceil(pagedJobs.totalCount / pagedJobs.pageSize) : 1;

  return (
    <div className="space-y-6">
      {/* Top Header & New Job Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--text-main)]">
            Dispatch & Delivery Orders
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Manage route lifecycles, assign drivers, and monitor delivery progress
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Create Job
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-[var(--text-muted)] mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" />
              Status:
            </span>
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => handleFilterChange(s)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)] ${
                  statusFilter === s
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {s === 'InTransit' ? 'In Transit' : s}
              </button>
            ))}
            {(statusFilter !== 'All' || searchQuery) && (
              <button
                onClick={() => {
                  handleFilterChange('All');
                  setSearchQuery('');
                }}
                className="rounded-full px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-64">
            <label htmlFor="job-search" className="sr-only">
              Search jobs
            </label>
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              id="job-search"
              placeholder="Filter by ID or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-page)] pl-8 pr-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>
      </Card>

      {/* Jobs Table */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton variant="table-row" />
            <Skeleton variant="table-row" />
            <Skeleton variant="table-row" />
            <Skeleton variant="table-row" />
          </div>
        ) : !filteredJobs || filteredJobs.length === 0 ? (
          <div className="p-12">
            <EmptyState
              message={statusFilter === 'All' ? 'No jobs found.' : `No jobs with status '${statusFilter}'.`}
              description="Create a new delivery job or reset the filter."
              action={
                <Button size="sm" variant="outline" onClick={() => handleFilterChange('All')}>
                  Clear filter
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-850/60 border-b border-[var(--border-hairline)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3">ID</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Pickup</th>
                  <th className="px-5 py-3">Dropoff</th>
                  <th className="px-5 py-3">Assigned Driver</th>
                  <th className="px-5 py-3 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {filteredJobs.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => openJobDetail(job)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openJobDetail(job);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`View details for Job #${job.id}`}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-850/40 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-inset"
                  >
                    <td className="px-5 py-3.5 font-semibold text-[var(--text-main)] tabular-nums">
                      #{job.id}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={job.status} size="sm" />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={job.priority} size="sm" />
                    </td>
                    <td className="px-5 py-3.5 max-w-xs truncate text-[var(--text-main)] font-medium">
                      {job.pickupAddress}
                    </td>
                    <td className="px-5 py-3.5 max-w-xs truncate text-[var(--text-muted)]">
                      {job.dropoffAddress}
                    </td>
                    <td className="px-5 py-3.5">
                      {job.assignedDriver ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-[var(--text-main)]">
                            {job.assignedDriver.fullName}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
                            ({job.assignedDriver.vehicleReg})
                          </span>
                        </div>
                      ) : (
                        <span className="italic text-zinc-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right text-[var(--text-muted)] tabular-nums">
                      {new Date(job.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {pagedJobs && pagedJobs.totalCount > 0 && (
          <div className="flex items-center justify-between border-t border-[var(--border-hairline)] px-5 py-3 bg-[var(--bg-surface)]">
            <p className="text-xs text-[var(--text-muted)]">
              Showing <span className="font-semibold tabular-nums">{filteredJobs?.length}</span> of{' '}
              <span className="font-semibold tabular-nums">{pagedJobs.totalCount}</span> jobs
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pageParam <= 1 || isFetching}
                onClick={() => handlePageChange(pageParam - 1)}
                aria-label="Previous page"
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                Page {pageParam} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pageParam >= totalPages || isFetching}
                onClick={() => handlePageChange(pageParam + 1)}
                aria-label="Next page"
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Job Detail Drawer */}
      <Drawer
        isOpen={!!selectedJob}
        onClose={closeJobDetail}
        title={selectedJob ? `Job #${selectedJob.id} Details` : ''}
        subtitle="Full job manifest, driver assignments, and status transitions"
      >
        {selectedJob && (
          <div className="space-y-6 text-xs">
            {/* Action error banner */}
            {actionError && (
              <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Badges strip */}
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border-hairline)]">
              <div className="flex items-center gap-2">
                <StatusBadge status={selectedJob.status} />
                <StatusBadge status={selectedJob.priority} />
              </div>
              <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                Version: {selectedJob.version}
              </span>
            </div>

            {/* Locations */}
            <div className="space-y-4 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-page)] p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                  Pickup Location
                </p>
                <p className="text-sm font-semibold text-[var(--text-main)] mt-1">
                  {selectedJob.pickupAddress}
                </p>
                <p className="text-[10px] text-zinc-400 mt-0.5 tabular-nums">
                  Coordinates: {selectedJob.pickupLat}, {selectedJob.pickupLng}
                </p>
              </div>

              <div className="border-t border-[var(--border-hairline)] pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-rose-500" />
                  Dropoff Location
                </p>
                <p className="text-sm font-semibold text-[var(--text-main)] mt-1">
                  {selectedJob.dropoffAddress}
                </p>
                <p className="text-[10px] text-zinc-400 mt-0.5 tabular-nums">
                  Coordinates: {selectedJob.dropoffLat}, {selectedJob.dropoffLng}
                </p>
              </div>
            </div>

            {/* Driver Assignment Section */}
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-page)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5" />
                  Assigned Driver
                </p>
                {selectedJob.status === 'Pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedDriverId('');
                      setIsAssignModalOpen(true);
                    }}
                  >
                    Assign Driver
                  </Button>
                )}
                {selectedJob.status === 'Assigned' && (
                  <Button
                    size="sm"
                    variant="outline"
                    isLoading={updateStatusMutation.isPending}
                    onClick={() =>
                      updateStatusMutation.mutate({ jobId: selectedJob.id, status: 'Pending' })
                    }
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Unassign
                  </Button>
                )}
              </div>

              {selectedJob.assignedDriver ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-[var(--text-main)]">
                      {selectedJob.assignedDriver.fullName}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                      Vehicle: {selectedJob.assignedDriver.vehicleReg}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-400 italic">No driver assigned yet.</p>
              )}
            </div>

            {/* Notes */}
            {selectedJob.notes && (
              <div className="rounded-lg border border-[var(--border-hairline)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Delivery Instructions & Notes
                </p>
                <p className="text-xs text-[var(--text-main)] mt-1 whitespace-pre-wrap">
                  {selectedJob.notes}
                </p>
              </div>
            )}

            {/* Timestamps */}
            <div className="border-t border-[var(--border-hairline)] pt-4 space-y-1 text-[11px] text-[var(--text-muted)]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Created:
                </span>
                <span className="tabular-nums">{new Date(selectedJob.createdAt).toUTCString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Last Updated:</span>
                <span className="tabular-nums">{new Date(selectedJob.updatedAt).toUTCString()}</span>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Driver Assignment Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Driver"
        subtitle={`Select an available driver for Job #${selectedJob?.id}`}
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[var(--text-muted)] mb-1">
              Select Fleet Driver
            </label>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value ? Number(e.target.value) : '')}
              required
              className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value="">-- Choose a driver --</option>
              {drivers?.map((driver) => {
                const isOffline = driver.currentStatus === 'Offline';
                return (
                  <option key={driver.id} value={driver.id} disabled={isOffline}>
                    {driver.fullName} ({driver.vehicleReg}) — {driver.currentStatus}
                  </option>
                );
              })}
            </select>
            <p className="text-[11px] text-zinc-400 mt-1">
              Note: Offline drivers cannot be assigned per dispatch policy rules.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--border-hairline)]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAssignModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={selectedDriverId === ''}
              isLoading={assignJobMutation.isPending}
            >
              Confirm Assignment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Job Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Delivery Job"
        subtitle="Enter the pickup and dropoff coordinates and priority"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="Pickup Address"
            placeholder="e.g. 14 Logistics Way, Industrial Park"
            value={newPickup}
            onChange={(e) => setNewPickup(e.target.value)}
            required
          />

          <Input
            label="Dropoff Address"
            placeholder="e.g. 88 Commercial Blvd, Suite 400"
            value={newDropoff}
            onChange={(e) => setNewDropoff(e.target.value)}
            required
          />

          <div className="space-y-1">
            <label className="block text-xs font-medium text-[var(--text-muted)]">
              Priority Level
            </label>
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as JobPriority)}
              className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value="Low">Low</option>
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-[var(--text-muted)]">
              Delivery Notes (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="Gate code, loading dock number, recipient instructions..."
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-main)] placeholder:text-zinc-400 focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--border-hairline)]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={createJobMutation.isPending}>
              Create Job
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
