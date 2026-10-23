import React from 'react';
import { cn } from '../../utils/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'text' | 'circular' | 'rectangular' | 'table-row' | 'card' | 'stat-tile';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'default',
  ...props
}) => {
  const baseStyles = 'animate-pulse rounded bg-zinc-200 dark:bg-zinc-800/80';

  const variants = {
    default: '',
    text: 'h-4 w-full',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
    'table-row': 'h-10 w-full',
    card: 'h-44 w-full rounded-lg',
    'stat-tile': 'h-7 w-16 rounded',
  };

  return (
    <div
      className={cn(baseStyles, variants[variant], className)}
      {...props}
    />
  );
};
