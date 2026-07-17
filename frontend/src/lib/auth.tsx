import { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import { clearAuth, loadStoredAuth, storeAuth, User } from './api';

type AuthContextValue = {
  token: string | null;
  user: User | null;
  setSession: (token: string, user: User) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = loadStoredAuth();
  const [token, setToken] = useState<string | null>(stored.token);
  const [user, setUser] = useState<User | null>(stored.user);

  const value = useMemo(
    () => ({
      token,
      user,
      setSession: (t: string, u: User) => {
        storeAuth(t, u);
        setToken(t);
        setUser(u);
      },
      logout: () => {
        clearAuth();
        setToken(null);
        setUser(null);
      },
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
