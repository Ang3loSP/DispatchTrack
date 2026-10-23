import React from 'react';
import type { JobStatus, DriverStatus, JobPriority } from '../../types';
import { cn } from '../../utils/cn';

interface StatusBadgeProps {
  status: JobStatus | DriverStatus | JobPriority | string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', className }) => {
  const getStyle = () => {
    switch (status) {
      // Job statuses
      case 'Pending':
        return {
          container: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
          dot: 'bg-zinc-500 dark:bg-zinc-400',
        };
      case 'Assigned':
        return {
          container: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
          dot: 'bg-sky-500 dark:bg-sky-400',
        };
      case 'InTransit':
        return {
          container: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          dot: 'bg-amber-500 dark:bg-amber-400',
        };
      case 'Delivered':
        return {
          container: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          dot: 'bg-emerald-500 dark:bg-emerald-400',
        };
      case 'Failed':
        return {
          container: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
          dot: 'bg-rose-500 dark:bg-rose-400',
        };

      // Driver statuses
      case 'Available':
        return {
          container: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          dot: 'bg-emerald-500',
        };
      case 'OnDelivery':
        return {
          container: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          dot: 'bg-amber-500',
        };
      case 'Offline':
        return {
          container: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800/40 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800',
          dot: 'bg-zinc-400',
        };

      // Priorities
      case 'Urgent':
        return {
          container: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
          dot: 'bg-rose-500',
        };
      case 'High':
        return {
          container: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          dot: 'bg-amber-500',
        };
      default:
        return {
          container: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800',
          dot: 'bg-zinc-400',
        };
    }
  };

  const style = getStyle();

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border transition-colors',
        size === 'sm' ? 'px-2 py-0.5 text-xs gap-1.5' : 'px-2.5 py-1 text-xs gap-2',
        style.container,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', style.dot)} />
      <span>{status === 'InTransit' ? 'In Transit' : status}</span>
    </span>
  );
};
