import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import axios from 'axios';

export const LoginPage: React.FC = () => {
  const { login, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already logged in, navigate
  React.useEffect(() => {
    if (user) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
      const target = from || (user.role === 'Driver' ? '/driver' : '/dashboard');
      navigate(target, { replace: true });
    }
  }, [user, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      // Navigation will be handled by the useEffect above
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail || err.response?.data?.title || 'Invalid credentials or login rejected.';
        setError(detail);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    setError(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-page)] p-4">
      {/* Top right theme toggle */}
      <div className="fixed top-4 right-4">
        <button
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded bg-[var(--color-accent)] text-white font-bold text-sm">
            DT
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-main)]">
            DispatchTrack
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Real-time delivery dispatch & logistics management
          </p>
        </div>

        {/* Login Card */}
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="name@dispatchtrack.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button type="submit" variant="primary" className="w-full" isLoading={isSubmitting}>
              Sign In
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </form>

          {/* Quick Demo Logins per Project Plan */}
          <div className="mt-6 border-t border-[var(--border-hairline)] pt-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] mb-2.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Demo Accounts (click to autofill)</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@dispatchtrack.local')}
                className="rounded border border-[var(--border-hairline)] bg-zinc-50 px-2 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300 dark:bg-zinc-850 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
                aria-label="Fill login credentials for Admin account"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('dispatcher@dispatchtrack.local')}
                className="rounded border border-[var(--border-hairline)] bg-zinc-50 px-2 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300 dark:bg-zinc-850 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
                aria-label="Fill login credentials for Dispatcher account"
              >
                Dispatcher
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('driver@dispatchtrack.local')}
                className="rounded border border-[var(--border-hairline)] bg-zinc-50 px-2 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300 dark:bg-zinc-850 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
                aria-label="Fill login credentials for Driver account"
              >
                Driver
              </button>
            </div>
          </div>
        </Card>

        {/* Footer info */}
        <p className="text-center text-[11px] text-zinc-400 dark:text-zinc-500">
          Single-container architecture • ASP.NET Core & PostgreSQL
        </p>
      </div>
    </div>
  );
};
