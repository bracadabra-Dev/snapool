import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { api, clearAuth, loadStoredAuth, storeAuth, User } from './api';

type AuthContextValue = {
  token: string | null;
  user: User | null;
  authReady: boolean;
  setSession: (token: string, user: User) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = loadStoredAuth();
  const [token, setToken] = useState<string | null>(stored.token);
  const [user, setUser] = useState<User | null>(stored.user);
  const [authReady, setAuthReady] = useState(!stored.token);

  useEffect(() => {
    if (!stored.token) return;

    let cancelled = false;
    void api
      .me(stored.token)
      .then(({ user: freshUser }) => {
        if (cancelled) return;
        storeAuth(stored.token!, freshUser);
        setUser(freshUser);
      })
      .catch(() => {
        if (cancelled) return;
        clearAuth();
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      authReady,
      setSession: (t: string, u: User) => {
        storeAuth(t, u);
        setToken(t);
        setUser(u);
        setAuthReady(true);
      },
      logout: () => {
        clearAuth();
        setToken(null);
        setUser(null);
        setAuthReady(true);
      },
    }),
    [token, user, authReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
