import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { driversApi, usersApi, demoApi } from '../api/endpoints';
import type { CreateUserInput, UserRole } from '../types';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { UserPlus, Shield, Truck, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import axios from 'axios';

export const AdminUsersPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('Driver');
  const [vehicleReg, setVehicleReg] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const { data: drivers, isLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn: driversApi.getDrivers,
  });

  const createUserMutation = useMutation({
    mutationFn: (input: CreateUserInput) => usersApi.createUser(input),
    onSuccess: (newUser) => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setIsModalOpen(false);
      setEmail('');
      setPassword('');
      setFullName('');
      setVehicleReg('');
      setFeedback({
        type: 'success',
        message: `User '${newUser.fullName}' (${newUser.role}) successfully created.`,
      });
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err)) {
        setFeedback({
          type: 'error',
          message: err.response?.data?.detail || 'Failed to create user.',
        });
      }
    },
  });

  const resetMutation = useMutation({
    mutationFn: demoApi.resetDemo,
    onSuccess: () => {
      queryClient.invalidateQueries();
      setFeedback({
        type: 'success',
        message: 'Demo database wiped and re-seeded to factory state.',
      });
    },
    onError: () => {
      setFeedback({
        type: 'error',
        message: 'Failed to reset demo database.',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) return;

    createUserMutation.mutate({
      email,
      password,
      fullName,
      role,
      vehicleReg: role === 'Driver' ? vehicleReg : undefined,
    });
  };

  const handleReset = () => {
    if (window.confirm('Reset all demo data back to default seed? This cannot be undone.')) {
      resetMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--text-main)]">
            User & Fleet Administration
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Provision staff accounts, inspect driver fleet status, and manage demo reset utilities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            isLoading={resetMutation.isPending}
            className="text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset Seed Data
          </Button>
          <Button size="sm" onClick={() => setIsModalOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" />
            Add Account
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-start gap-2 rounded-md p-3 text-xs border ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Role explanation cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-xs text-[var(--text-main)]">
            <Shield className="h-4 w-4 text-[var(--color-accent)]" />
            <span>Admin</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Full system control, account creation, and demo database state management.
          </p>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-xs text-[var(--text-main)]">
            <UserPlus className="h-4 w-4 text-sky-500" />
            <span>Dispatcher</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Create delivery jobs, optimize routes, and assign jobs to fleet drivers.
          </p>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-xs text-[var(--text-main)]">
            <Truck className="h-4 w-4 text-emerald-500" />
            <span>Driver</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Mobile-optimized portal to execute delivery stop transitions in real time.
          </p>
        </Card>
      </div>

      {/* Fleet Drivers Table */}
      <Card className="p-0 overflow-hidden">
        <CardHeader className="p-5 border-b border-[var(--border-hairline)] mb-0">
          <div>
            <CardTitle>Registered Fleet Drivers</CardTitle>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Current active drivers and their vehicle registrations
            </p>
          </div>
        </CardHeader>

        {isLoading ? (
          <div className="p-5 space-y-3">
            <Skeleton variant="table-row" />
            <Skeleton variant="table-row" />
          </div>
        ) : !drivers || drivers.length === 0 ? (
          <div className="p-8">
            <EmptyState message="No drivers registered in the system yet." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-850/60 border-b border-[var(--border-hairline)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3">ID</th>
                  <th className="px-5 py-3">Full Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Vehicle Reg</th>
                  <th className="px-5 py-3">Current Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {drivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-850/40">
                    <td className="px-5 py-3.5 font-semibold text-[var(--text-main)] tabular-nums">
                      #{driver.id}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-[var(--text-main)]">
                      {driver.fullName}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--text-muted)]">{driver.email}</td>
                    <td className="px-5 py-3.5 tabular-nums text-[var(--text-main)] font-mono">
                      {driver.vehicleReg || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={driver.currentStatus} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Provision User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Provision User Account"
        subtitle="Create an internal Dispatcher or Driver account"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="e.g. Sarah Jenkins"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="e.g. sjenkins@dispatchtrack.local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Initial Password"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />

          <div className="space-y-1">
            <label className="block text-xs font-medium text-[var(--text-muted)]">
              Assigned Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value="Dispatcher">Dispatcher</option>
              <option value="Driver">Driver</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          {role === 'Driver' && (
            <Input
              label="Vehicle Registration / Fleet Plate"
              placeholder="e.g. CA 492-811"
              value={vehicleReg}
              onChange={(e) => setVehicleReg(e.target.value)}
              required
            />
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--border-hairline)]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={createUserMutation.isPending}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
