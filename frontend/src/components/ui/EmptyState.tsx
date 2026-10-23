import React from 'react';
import { cn } from '../../utils/cn';

export interface EmptyStateProps {
  message?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  message = 'No data available.',
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border-hairline)] p-8 text-center',
        className
      )}
    >
      <p className="text-sm font-medium text-[var(--text-muted)]">{message}</p>
      {description && (
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
