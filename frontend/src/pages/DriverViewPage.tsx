import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { driversApi, jobsApi } from '../api/endpoints';
import type { Job, JobStatus } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import {
  Navigation,
  CheckCircle,
  XCircle,
  MapPin,
  FileText,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import axios from 'axios';

export const DriverViewPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedJobForFail, setSelectedJobForFail] = useState<Job | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const { data: jobs, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['myJobs'],
    queryFn: driversApi.getMyJobs,
    refetchInterval: 15000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ jobId, status }: { jobId: number; status: JobStatus }) =>
      jobsApi.updateJobStatus(jobId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myJobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setSelectedJobForFail(null);
      setTransitionError(null);
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err)) {
        setTransitionError(err.response?.data?.detail || 'Failed to update job status.');
      } else {
        setTransitionError('Network error while updating delivery.');
      }
    },
  });

  const handleStartDelivery = (jobId: number) => {
    setTransitionError(null);
    updateStatusMutation.mutate({ jobId, status: 'InTransit' });
  };

  const handleCompleteDelivery = (jobId: number) => {
    setTransitionError(null);
    updateStatusMutation.mutate({ jobId, status: 'Delivered' });
  };

  const handleConfirmFailed = () => {
    if (!selectedJobForFail) return;
    setTransitionError(null);
    updateStatusMutation.mutate({ jobId: selectedJobForFail.id, status: 'Failed' });
  };

  const activeJobs = jobs?.filter((j) => j.status === 'Assigned' || j.status === 'InTransit') || [];
  const completedJobs = jobs?.filter((j) => j.status === 'Delivered' || j.status === 'Failed') || [];

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Driver Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--text-main)]">
            My Delivery Manifest
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Tap cards to execute stop-by-stop delivery transitions
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
          aria-label="Refresh job list"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {transitionError && (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{transitionError}</span>
        </div>
      )}

      {/* Active Deliveries Queue */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Active Stops ({activeJobs.length})
        </h3>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </div>
        ) : activeJobs.length === 0 ? (
          <EmptyState
            message="No active jobs assigned to you right now."
            description="Your dispatcher will notify you when new stops are added to your route."
          />
        ) : (
          activeJobs.map((job) => {
            const isPendingStart = job.status === 'Assigned';
            const isInTransit = job.status === 'InTransit';

            return (
              <Card
                key={job.id}
                className="p-5 border-l-4 border-l-[var(--color-accent)] space-y-4 shadow-xs"
              >
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-[var(--text-main)] tabular-nums">
                    Job #{job.id}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={job.priority} size="sm" />
                    <StatusBadge status={job.status} size="sm" />
                  </div>
                </div>

                {/* Route stops */}
                <div className="space-y-3 bg-[var(--bg-page)] rounded-md p-3.5 border border-[var(--border-hairline)] text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                      Pickup Stop
                    </span>
                    <p className="font-semibold text-[var(--text-main)] mt-0.5">
                      {job.pickupAddress}
                    </p>
                  </div>

                  <div className="border-t border-[var(--border-hairline)] pt-2.5">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-rose-500" />
                      Dropoff Destination
                    </span>
                    <p className="font-semibold text-[var(--text-main)] mt-0.5">
                      {job.dropoffAddress}
                    </p>
                  </div>
                </div>

                {/* Special Instructions / Notes */}
                {job.notes && (
                  <div className="flex items-start gap-2 text-xs text-[var(--text-muted)] bg-zinc-50 dark:bg-zinc-850/50 p-2.5 rounded-md">
                    <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5 text-zinc-400" />
                    <p className="leading-snug">{job.notes}</p>
                  </div>
                )}

                {/* Action Buttons (Large thumb-reachable touch targets) */}
                <div className="pt-2">
                  {isPendingStart && (
                    <Button
                      size="lg"
                      className="w-full text-sm font-semibold"
                      isLoading={updateStatusMutation.isPending}
                      onClick={() => handleStartDelivery(job.id)}
                    >
                      <Navigation className="h-4 w-4 mr-2" />
                      Start Delivery
                    </Button>
                  )}

                  {isInTransit && (
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        size="lg"
                        variant="danger"
                        className="w-full text-xs font-semibold"
                        onClick={() => setSelectedJobForFail(job)}
                      >
                        <XCircle className="h-4 w-4 mr-1.5" />
                        Report Failed
                      </Button>
                      <Button
                        size="lg"
                        variant="success"
                        className="w-full text-xs font-semibold"
                        isLoading={updateStatusMutation.isPending}
                        onClick={() => handleCompleteDelivery(job.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1.5" />
                        Delivered
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Completed deliveries history */}
      {completedJobs.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-[var(--border-hairline)]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Completed Today ({completedJobs.length})
          </h3>
          <div className="space-y-2">
            {completedJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--text-main)] tabular-nums">
                      Job #{job.id}
                    </span>
                    <StatusBadge status={job.status} size="sm" />
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate max-w-xs">
                    {job.dropoffAddress}
                  </p>
                </div>
                <span className="text-[10px] text-zinc-400 tabular-nums">
                  {new Date(job.updatedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report Failed Confirmation Modal */}
      <Modal
        isOpen={!!selectedJobForFail}
        onClose={() => setSelectedJobForFail(null)}
        title="Mark Delivery as Failed"
        subtitle={`Confirm exception for Job #${selectedJobForFail?.id}`}
      >
        <div className="space-y-4 text-xs">
          <p className="text-[var(--text-main)]">
            Are you sure you want to mark this stop as <strong>Failed</strong>?
          </p>
          <p className="text-[var(--text-muted)]">
            This will mark the job as terminal and notify dispatch for immediate follow-up.
          </p>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--border-hairline)]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedJobForFail(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={updateStatusMutation.isPending}
              onClick={handleConfirmFailed}
            >
              Confirm Failed
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
