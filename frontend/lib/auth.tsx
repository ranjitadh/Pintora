"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, onLogout } from "./api";
import type { Cart, User } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  cartCount: number;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (
    payload: {
      email: string;
      first_name: string;
      last_name: string;
      password: string;
      password_confirm: string;
    }
  ) => Promise<User>;
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
    try {
      const cart = await api.get<Cart>("/cart/");
      setCartCount(cart.item_count);
    } catch {
      setCartCount(0);
    }
  }, []);

  useEffect(() => {
    // Tokens live in HttpOnly cookies; confirm the session with /auth/me/.
    api
      .get<User>("/auth/me/")
      .then((data) => {
        setUser(data);
        loadCart();
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [loadCart]);

  useEffect(() => {
    const handler = () => loadCart();
    window.addEventListener("printora:cart", handler);
    return () => window.removeEventListener("printora:cart", handler);
  }, [loadCart]);

  useEffect(() => {
    const unsubscribe = onLogout(() => {
      setUser(null);
      setCartCount(0);
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post("/auth/login/", { email, password }, { auth: false });
    setUser(data.user as User);
    loadCart();
    return data.user as User;
  }, [loadCart]);

  const register = useCallback(
    async (payload: {
      email: string;
      first_name: string;
      last_name: string;
      password: string;
      password_confirm: string;
    }) => {
      const data = await api.post("/auth/register/", payload, { auth: false });
      setUser(data.user as User);
      loadCart();
      return data.user as User;
    },
    [loadCart]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout/", {}, { auth: false });
    } catch {
      // Ignore logout errors; clear local state regardless.
    }
    setUser(null);
    setCartCount(0);
    window.dispatchEvent(new Event("printora:logout"));
  }, []);

  const refreshUser = useCallback(async () => {
    const data = await api.get<User>("/auth/me/");
    setUser(data);
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
