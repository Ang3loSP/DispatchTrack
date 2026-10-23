/* oxlint-disable react/only-export-components */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { UserProfile } from '../types';
import { authApi } from '../api/endpoints';
import { setAccessToken } from '../api/client';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const auth = await authApi.refresh();
      setAccessToken(auth.accessToken);
      setUser(auth.user);
    } catch {
      setAccessToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    authApi
      .refresh()
      .then((auth) => {
        if (isMounted) {
          setAccessToken(auth.accessToken);
          setUser(auth.user);
        }
      })
      .catch(() => {
        if (isMounted) {
          setAccessToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    const handleAuthExpired = () => {
      setUser(null);
      setAccessToken(null);
    };

    window.addEventListener('dispatchtrack:auth-expired', handleAuthExpired);
    return () => {
      isMounted = false;
      window.removeEventListener('dispatchtrack:auth-expired', handleAuthExpired);
    };
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(email, pass);
      setAccessToken(response.accessToken);
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

