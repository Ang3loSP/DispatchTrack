import React from 'react';
import { cn } from '../../utils/cn';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, disabled, children, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)] disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer active:scale-[0.98] min-h-[44px]';

    const variants = {
      primary:
        'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white focus-visible:ring-[var(--color-accent)]',
      secondary:
        'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 border border-[var(--border-hairline)] focus-visible:ring-zinc-400',
      outline:
        'border border-[var(--border-hairline)] bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-850 text-zinc-800 dark:text-zinc-200 focus-visible:ring-zinc-400',
      danger:
        'bg-rose-600 hover:bg-rose-700 text-white focus-visible:ring-rose-500',
      success:
        'bg-emerald-600 hover:bg-emerald-700 text-white focus-visible:ring-emerald-500',
      ghost:
        'bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus-visible:ring-zinc-400',
    };

    const sizes = {
      sm: 'h-8 px-2.5 text-xs gap-1.5',
      md: 'h-9 px-3.5 text-sm gap-2',
      lg: 'h-12 px-5 text-sm font-semibold gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
