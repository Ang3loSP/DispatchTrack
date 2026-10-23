import React from 'react';
import { cn } from '../../utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  interactive?: boolean;
}

export const Card = ({ className, children, interactive = false, ...props }: CardProps) => {
  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 transition-colors',
        interactive && 'cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ className, children, ...props }: CardProps) => {
  return (
    <div className={cn('mb-4 flex items-center justify-between', className)} {...props}>
      {children}
    </div>
  );
};

export const CardTitle = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) => {
  return (
    <h3
      className={cn('text-sm font-semibold tracking-tight text-[var(--text-main)]', className)}
      {...props}
    >
      {children}
    </h3>
  );
};
