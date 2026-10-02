import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, ApiRequestError } from '../api/client';
import { isTransientStatus } from '../lib/failure';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'customer' | 'admin';
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

interface AuthState {
  user: User | null;
  /** True until the first /api/auth/me call has finished. */
  loading: boolean;
  /** Set when the login check itself failed in a way that can pass (network, 5xx, 429). The user is not treated as logged out. */
  checkError: string | null;
  /** Repeats the login check. */
  retryCheck: () => void;
  login: (email: string, password: string, rememberMe: boolean) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  /** Changes the display name (PATCH /api/auth/me) and updates the signed-in user. Throws ApiRequestError. */
  updateName: (name: string) => Promise<User>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCheckError(null);
    api<{ user: User }>('/api/auth/me')
      .then((res) => {
        if (!cancelled) setUser(res.user);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setUser(null);
        if (err instanceof ApiRequestError && isTransientStatus(err.status)) setCheckError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retryCheck = useCallback(() => setAttempt((n) => n + 1), []);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean) => {
    const res = await api<{ user: User }>('/api/auth/login', { method: 'POST', body: { email, password, rememberMe } });
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const res = await api<{ user: User }>('/api/auth/register', { method: 'POST', body: input });
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api<void>('/api/auth/logout', { method: 'POST' });
    } catch {
      // The session is already gone on the server (for example expired), so clear it locally too.
    }
    setUser(null);
  }, []);

  const updateName = useCallback(async (name: string) => {
    const res = await api<{ user: User }>('/api/auth/me', { method: 'PATCH', body: { name } });
    setUser(res.user);
    return res.user;
  }, []);

  const value = useMemo(
    () => ({ user, loading, checkError, retryCheck, login, register, logout, updateName }),
    [user, loading, checkError, retryCheck, login, register, logout, updateName],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
