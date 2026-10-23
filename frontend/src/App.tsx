import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Shell } from './components/layout/Shell';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { JobsPage } from './pages/JobsPage';
import { DriverViewPage } from './pages/DriverViewPage';
import { AdminUsersPage } from './pages/AdminUsersPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
});

const RootRedirect: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--bg-page)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
          <p className="text-xs font-medium text-[var(--text-muted)]">Loading DispatchTrack...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'Driver') {
    return <Navigate to="/driver" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected App Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['Admin', 'Dispatcher']}>
                    <Shell>
                      <DashboardPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/jobs"
                element={
                  <ProtectedRoute allowedRoles={['Admin', 'Dispatcher']}>
                    <Shell>
                      <JobsPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/driver"
                element={
                  <ProtectedRoute allowedRoles={['Driver', 'Admin']}>
                    <Shell>
                      <DriverViewPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/users"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <Shell>
                      <AdminUsersPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />

              {/* Root and Fallback */}
              <Route path="/" element={<RootRedirect />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
