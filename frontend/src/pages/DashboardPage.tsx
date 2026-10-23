import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, jobsApi, driversApi } from '../api/endpoints';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Clock, Truck, CheckCircle2, UserX, ArrowRight, Plus, MapPin } from 'lucide-react';
import type { Job } from '../types';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const { data: summary, isLoading: isLoadingSummary, dataUpdatedAt } = useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: dashboardApi.getSummary,
    refetchInterval: 10000, // auto poll dashboard metrics every 10s
  });

  const { data: recentJobs, isLoading: isLoadingJobs } = useQuery({
    queryKey: ['recentJobs'],
    queryFn: () => jobsApi.getJobs({ page: 1, pageSize: 6 }),
  });

  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: driversApi.getDrivers,
  });

  const pendingCount = summary?.jobsByStatus?.['Pending'] ?? 0;
  const inTransitCount = summary?.jobsByStatus?.['InTransit'] ?? 0;
  const deliveredTodayCount = summary?.jobsCreatedToday ?? 0; // or delivered count
  const offlineDriversCount = summary?.driversByStatus?.['Offline'] ?? 0;

  const statTiles = [
    {
      title: 'Pending Dispatch',
      value: pendingCount,
      icon: Clock,
      color: 'text-zinc-600 dark:text-zinc-400',
      action: () => navigate('/jobs?status=Pending'),
    },
    {
      title: 'In Transit',
      value: inTransitCount,
      icon: Truck,
      color: 'text-amber-500',
      action: () => navigate('/jobs?status=InTransit'),
    },
    {
      title: 'Jobs Created Today',
      value: deliveredTodayCount,
      icon: CheckCircle2,
      color: 'text-emerald-500',
      action: () => navigate('/jobs'),
    },
    {
      title: 'Offline Drivers',
      value: offlineDriversCount,
      icon: UserX,
      color: 'text-zinc-400',
      action: () => navigate('/jobs'),
    },
  ];

  const unassignedJobs = recentJobs?.items?.filter((j) => j.status === 'Pending') || [];

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--text-main)]">
            Operations Overview
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Real-time fleet activity, unassigned queues, and job metrics
          </p>
        </div>
        <Button
          onClick={() => navigate('/jobs?create=true')}
          size="sm"
          className="self-start sm:self-auto"
        >
          <Plus className="h-4 w-4 mr-1" />
          Create Job
        </Button>
      </div>

      {/* 4 Stat Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
{statTiles.map((tile, i) => {
            const Icon = tile.icon;
            return (
              <Card
                key={i}
                onClick={tile.action}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    tile.action();
                  }
                }}
                tabIndex={0}
                role="button"
                interactive
                className="cursor-pointer transition-all group p-4"
              >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--text-muted)]">{tile.title}</span>
                <Icon className={`h-4 w-4 ${tile.color} transition-transform group-hover:scale-110`} />
              </div>
              <div className="mt-3">
                {isLoadingSummary ? (
                  <Skeleton variant="stat-tile" />
                ) : (
                  <span className="text-2xl font-bold tracking-tight tabular-nums text-[var(--text-main)]">
                    {tile.value}
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      {dataUpdatedAt && (
        <p className="text-[11px] text-[var(--text-muted)]">
          Last updated: {new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Jobs Table (2 Cols on Large) */}
        <div className="lg:col-span-2 space-y-3">
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-hairline)]">
              <div>
                <CardTitle>Active Jobs Feed</CardTitle>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Latest job updates and routing status
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/jobs')}
                className="text-xs gap-1"
              >
                <span>View all</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {isLoadingJobs ? (
              <div className="p-5 space-y-3">
                <Skeleton variant="table-row" />
                <Skeleton variant="table-row" />
                <Skeleton variant="table-row" />
              </div>
            ) : !recentJobs?.items || recentJobs.items.length === 0 ? (
              <div className="p-8">
                <EmptyState message="No recent jobs created." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-850/60 border-b border-[var(--border-hairline)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-5 py-2.5">ID</th>
                      <th className="px-5 py-2.5">Status</th>
                      <th className="px-5 py-2.5">Route</th>
                      <th className="px-5 py-2.5">Assigned Driver</th>
                      <th className="px-5 py-2.5 text-right">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-hairline)]">
                    {recentJobs.items.map((job: Job) => (
                      <tr
                        key={job.id}
                        onClick={() => navigate(`/jobs?jobId=${job.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate(`/jobs?jobId=${job.id}`);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`View details for Job #${job.id}`}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-850/40 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-inset"
                      >
                        <td className="px-5 py-3 font-semibold text-[var(--text-main)] tabular-nums">
                          #{job.id}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={job.status} size="sm" />
                        </td>
                        <td className="px-5 py-3 max-w-xs truncate text-[var(--text-main)]">
                          <span className="font-medium">{job.pickupAddress}</span>
                          <span className="text-[var(--text-muted)] mx-1">→</span>
                          <span className="text-[var(--text-muted)]">{job.dropoffAddress}</span>
                        </td>
                        <td className="px-5 py-3 text-[var(--text-muted)]">
                          {job.assignedDriver ? (
                            <span className="text-[var(--text-main)] font-medium">
                              {job.assignedDriver.fullName}
                            </span>
                          ) : (
                            <span className="italic text-zinc-400">Unassigned</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right text-[var(--text-muted)] tabular-nums">
                          {new Date(job.updatedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Unassigned Queue & Active Fleet Sidebar (1 Col) */}
        <div className="space-y-6">
          {/* Unassigned Queue */}
          <Card className="p-5">
            <CardHeader className="mb-3">
              <div>
                <CardTitle>Unassigned Queue</CardTitle>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Needs dispatcher attention
                </p>
              </div>
              <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold px-2 py-0.5 text-xs">
                {unassignedJobs.length}
              </span>
            </CardHeader>

            {unassignedJobs.length === 0 ? (
              <EmptyState message="No unassigned jobs — nice work." className="p-4" />
            ) : (
              <div className="space-y-2.5">
                {unassignedJobs.slice(0, 4).map((job) => (
                  <div
                    key={job.id}
                    onClick={() => navigate(`/jobs?jobId=${job.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/jobs?jobId=${job.id}`);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`View details for Job #${job.id}`}
                    className="p-3 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-page)] hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-[var(--text-main)]">
                        Job #{job.id}
                      </span>
                      <StatusBadge status={job.priority} size="sm" />
                    </div>
                    <div className="flex items-start gap-1 text-[11px] text-[var(--text-muted)] truncate">
                      <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                      <span className="truncate">{job.dropoffAddress}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Active Fleet Summary */}
          <Card className="p-5">
            <CardHeader className="mb-3">
              <div>
                <CardTitle>Fleet Status</CardTitle>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Available drivers for routing
                </p>
              </div>
            </CardHeader>

            {!drivers || drivers.length === 0 ? (
              <EmptyState message="No drivers registered." className="p-4" />
            ) : (
              <div className="space-y-2">
                {drivers.slice(0, 5).map((driver) => (
                  <div
                    key={driver.id}
                    className="flex items-center justify-between py-2 border-b border-[var(--border-hairline)] last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[var(--text-main)] truncate">
                        {driver.fullName}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] tabular-nums">
                        {driver.vehicleReg}
                      </p>
                    </div>
                    <StatusBadge status={driver.currentStatus} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
