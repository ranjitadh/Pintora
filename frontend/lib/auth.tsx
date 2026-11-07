"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, cacheUser, cachedUser, clearSession, getAccessToken, setTokens } from "./api";
import type { Cart, User } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  cartCount: number;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: { email: string; first_name: string; last_name: string; password: string; password_confirm: string }) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);

  const loadCart = useCallback(async () => {
    if (!getAccessToken()) {
      setCartCount(0);
      return;
    }
    try {
      const cart = await api.get<Cart>("/cart/");
      setCartCount(cart.item_count);
    } catch {
      setCartCount(0);
    }
  }, []);

  useEffect(() => {
    const cached = cachedUser();
    if (cached) setUser(cached);
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    api
      .get<User>("/auth/me/")
      .then((data) => {
        setUser(data);
        cacheUser(data);
        loadCart();
      })
      .catch(() => {
        setUser(null);
        clearSession();
      })
      .finally(() => setLoading(false));
  }, [loadCart]);

  useEffect(() => {
    const handler = () => loadCart();
    window.addEventListener("printora:cart", handler);
    return () => window.removeEventListener("printora:cart", handler);
  }, [loadCart]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post("/auth/login/", { email, password }, { auth: false });
    setTokens(data.access, data.refresh);
    cacheUser(data.user);
    setUser(data.user);
    loadCart();
    return data.user as User;
  }, [loadCart]);

  const register = useCallback(
    async (payload: { email: string; first_name: string; last_name: string; password: string; password_confirm: string }) => {
      const data = await api.post("/auth/register/", payload, { auth: false });
      setTokens(data.access, data.refresh);
      cacheUser(data.user);
      setUser(data.user);
      loadCart();
      return data.user as User;
    },
    [loadCart]
  );

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setCartCount(0);
  }, []);

  const refreshUser = useCallback(async () => {
    const data = await api.get<User>("/auth/me/");
    setUser(data);
    cacheUser(data);
  }, []);

  const refreshCart = useCallback(async () => {
    await loadCart();
  }, [loadCart]);

  const value = useMemo(
    () => ({
      user,
      loading,
      cartCount,
      isAdmin: !!user && (user.role === "admin" || user.role === "staff" || user.is_superuser),
      login,
      register,
      logout,
      refreshUser,
      refreshCart,
    }),
    [user, loading, cartCount, login, register, logout, refreshUser, refreshCart]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function notifyCart() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("printora:cart"));
}
