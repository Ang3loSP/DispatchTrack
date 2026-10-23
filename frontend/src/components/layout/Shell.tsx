import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  Users,
  LogOut,
  Sun,
  Moon,
  RotateCcw,
  Package,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { demoApi } from '../../api/endpoints';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface ShellProps {
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleDemoReset = async () => {
    setIsResetting(true);
    try {
      await demoApi.resetDemo();
      window.location.reload();
    } catch (err) {
      alert('Failed to reset demo data.');
      console.error(err);
    } finally {
      setIsResetting(false);
      setShowResetConfirm(false);
    }
  };

  const navItems = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      roles: ['Admin', 'Dispatcher'],
    },
    {
      label: 'Jobs',
      path: '/jobs',
      icon: Package,
      roles: ['Admin', 'Dispatcher'],
    },
    {
      label: 'Driver',
      path: '/driver',
      icon: Truck,
      roles: ['Driver', 'Admin'],
    },
    {
      label: 'Team',
      path: '/users',
      icon: Users,
      roles: ['Admin'],
    },
  ].filter((item) => user && item.roles.includes(user.role));

  const getPageTitle = () => {
    if (location.pathname.startsWith('/dashboard')) return 'Operations Dashboard';
    if (location.pathname.startsWith('/jobs')) return 'Dispatch & Jobs Management';
    if (location.pathname.startsWith('/driver')) return 'Driver Portal';
    if (location.pathname.startsWith('/users')) return 'User & Driver Provisioning';
    return 'DispatchTrack';
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg-page)] text-[var(--text-main)]">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-[var(--border-hairline)] bg-[var(--bg-surface)] transition-all duration-200 z-30 select-none',
          isSidebarCollapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Brand / Logo */}
        <div className="flex h-14 items-center justify-between px-4 border-b border-[var(--border-hairline)]">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-[var(--color-accent)] text-white font-bold text-xs">
                DT
              </div>
              <span className="font-semibold text-sm tracking-tight text-[var(--text-main)]">
                DispatchTrack
              </span>
            </div>
          )}
          {isSidebarCollapsed && (
            <div className="mx-auto flex h-7 w-7 items-center justify-center rounded bg-[var(--color-accent)] text-white font-bold text-xs">
              DT
            </div>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:inline-flex rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }: { isActive: boolean }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-850 dark:hover:text-zinc-100',
                    isSidebarCollapsed && 'justify-center px-0'
                  )
                }
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* User Card & Logout in Sidebar */}
        <div className="border-t border-[var(--border-hairline)] p-3">
          <div
            className={cn(
              'flex items-center gap-3 rounded-md px-2 py-2',
              isSidebarCollapsed && 'justify-center px-0'
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-xs font-semibold shrink-0">
              {user?.fullName.charAt(0) || 'U'}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{user?.fullName}</p>
                <p className="text-[10px] text-[var(--text-muted)] truncate">{user?.role}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={cn(
              'mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]',
              isSidebarCollapsed && 'justify-center px-0'
            )}
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isSidebarCollapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex flex-1 flex-col min-w-0 pb-16 md:pb-0">
        {/* Sticky Topbar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/85 px-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <h1 className="text-sm font-semibold tracking-tight">{getPageTitle()}</h1>
          </div>

          <div className="flex items-center gap-2">
            {user?.role === 'Admin' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResetConfirm(true)}
                isLoading={isResetting}
                title="Reset demo database back to initial seed data"
                className="hidden sm:inline-flex text-xs"
                aria-label="Reset demo database"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Reset Demo
              </Button>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-hairline)] bg-transparent text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Role indicator badge */}
            <span className="hidden sm:inline-flex rounded-full border border-[var(--border-hairline)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)] bg-[var(--bg-page)]">
              {user?.role}
            </span>
          </div>
        </header>

        {/* Mobile Dropdown Menu if toggled */}
        {isMobileMenuOpen && (
          <div id="mobile-menu" className="md:hidden border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 space-y-1" role="navigation" aria-label="Mobile navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }: { isActive: boolean }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                      isActive
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400'
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
            {user?.role === 'Admin' && (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset Demo Data</span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
            >
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </button>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">{children}</main>

        {/* Mobile Bottom Navigation Bar (Driver-focused per DESIGN.md) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex h-14 items-center justify-around border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]/90 backdrop-blur-md px-2" aria-label="Bottom navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }: { isActive: boolean }) =>
                  cn(
                    'flex flex-col items-center justify-center py-1 px-3 text-[10px] font-medium transition-colors',
                    isActive
                      ? 'text-[var(--color-accent)] font-semibold border-t-2 border-[var(--color-accent)]'
                      : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
                  )
                }
              >
                <Icon className="h-5 w-5 mb-0.5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Demo Reset Confirmation Modal */}
        <Modal
          isOpen={showResetConfirm}
          onClose={() => setShowResetConfirm(false)}
          title="Reset Demo Database"
          subtitle="This will wipe all data and restore the initial seed. This cannot be undone."
        >
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--border-hairline)]">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isResetting}
              onClick={handleDemoReset}
            >
              Confirm Reset
            </Button>
          </div>
        </Modal>
      </div>
    </div>
  );
};
