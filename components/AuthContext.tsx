"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AuthUser = {
  id: string;
  line_uid: string;
  name: string | null;
  gender: string | null;
  grade: number | null;
  university: string | null;
  club: string | null;
  desired_dept: string | null;
  created_at: string;
};

type LoginPayload = {
  idToken?: string;
  accessToken?: string;
  devLogin?: boolean;
  profile?: {
    displayName?: string;
  };
};

export type AuthContextType = {
  isLoggedIn: boolean;
  token: string;
  user: AuthUser | null;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  isLoginModalOpen: boolean;
  loginWithLine: (payload: LoginPayload) => Promise<{ needsOnboarding: boolean; user: AuthUser }>;
  logout: () => void;
  refreshMe: () => Promise<AuthUser | null>;
  hydrated: boolean;
};

const STORAGE_KEY = "sb_token";
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const persistToken = useCallback((nextToken: string) => {
    setToken(nextToken);
    if (nextToken) {
      window.localStorage.setItem(STORAGE_KEY, nextToken);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const refreshMe = useCallback(async () => {
    const nextToken = window.localStorage.getItem(STORAGE_KEY) || token;
    if (!nextToken) {
      setUser(null);
      return null;
    }

    const res = await fetch("/api/me", {
      headers: {
        Authorization: `Bearer ${nextToken}`,
      },
    });

    if (!res.ok) {
      persistToken("");
      setUser(null);
      return null;
    }

    const data = (await res.json()) as { user: AuthUser };
    setUser(data.user);
    if (!token) setToken(nextToken);
    return data.user;
  }, [persistToken, token]);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(STORAGE_KEY) || "";
    if (!storedToken) {
      setHydrated(true);
      return;
    }

    setToken(storedToken);
    void refreshMe().finally(() => setHydrated(true));
  }, [refreshMe]);

  const openLoginModal = useCallback(() => setIsLoginModalOpen(true), []);
  const closeLoginModal = useCallback(() => setIsLoginModalOpen(false), []);

  const loginWithLine = useCallback(async (payload: LoginPayload) => {
    const res = await fetch("/api/auth/line", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error("LINE login failed");
    }

    const data = (await res.json()) as {
      token: string;
      user: AuthUser;
      needsOnboarding: boolean;
    };

    persistToken(data.token);
    setUser(data.user);
    setIsLoginModalOpen(false);

    return {
      needsOnboarding: data.needsOnboarding,
      user: data.user,
    };
  }, [persistToken]);

  const logout = useCallback(() => {
    persistToken("");
    setUser(null);
  }, [persistToken]);

  const value = useMemo(
    () => ({
      isLoggedIn: Boolean(token && user),
      token,
      user,
      openLoginModal,
      closeLoginModal,
      isLoginModalOpen,
      loginWithLine,
      logout,
      refreshMe,
      hydrated,
    }),
    [token, user, openLoginModal, closeLoginModal, isLoginModalOpen, loginWithLine, logout, refreshMe, hydrated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
