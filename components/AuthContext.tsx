"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MeDto } from "@/lib/auth/types";
import { readRequiredApiJson } from "@/lib/api-client";
import {
  clearPendingLegalConsent,
  readPendingLegalConsent,
  storePendingLegalConsent,
} from "@/lib/auth/pending-legal-consent";
import { hasSessionHintCookie } from "@/lib/auth/session-hint";
import type { LegalConsentVersion } from "@/lib/legal-consent";
import { getLiffIdToken, initLiff, loginWithLiff, logoutFromLiff } from "@/lib/liff/client";

type AuthContextType = {
  isLoggedIn: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  isLoginModalOpen: boolean;
  login: (legalConsentVersion: LegalConsentVersion) => Promise<"authenticated" | "redirecting">;
  logout: () => Promise<LogoutResult>;
  hydrated: boolean;
  error: string | null;
  me: MeDto | null;
  refreshMe: () => Promise<void>;
};

export type LogoutResult =
  | { status: "success"; appSession: "ended"; liffSession: "ended" }
  | { status: "partial"; appSession: "ended"; liffSession: "failed" }
  | { status: "failed"; appSession: "failed"; liffSession: "not_attempted" };

type ApiMeSuccess = { ok: true; item: MeDto };

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchMe() {
  // セッションが無いことが確定しているときはリクエストを送らない。
  // 未ログイン訪問者の `/api/me` 401 が、全ルートでコンソールエラーとして
  // 残っていた (想定内の 401 なのに「壊れている」ように見える)。
  if (!hasSessionHintCookie()) return null;
  const response = await fetch("/api/me", { cache: "no-store" });
  if (response.status === 401) {
    await fetch("/api/auth/line/session", { method: "DELETE" }).catch(() => undefined);
    return null;
  }
  const data = await readRequiredApiJson<ApiMeSuccess>(response, "プロフィールの取得に失敗しました");
  return data.item;
}

async function createLineSession(idToken: string, legalConsentVersion: LegalConsentVersion) {
  const response = await fetch("/api/auth/line/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken, legalConsentVersion }),
  });
  const data = await readRequiredApiJson<ApiMeSuccess>(response, "LINEセッションの作成に失敗しました");
  return data.item;
}

function loginErrorMessage(caught: unknown) {
  if (!(caught instanceof Error)) return "LINEログインを開始できませんでした";
  if (caught.message === "Failed to fetch") return "LINEログインの初期化に失敗しました。通信状態を確認して、もう一度お試しください。";
  return caught.message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeDto | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshMe = useCallback(async () => {
    const nextMe = await fetchMe();
    setMe(nextMe);
  }, []);

  const login = useCallback(async (legalConsentVersion: LegalConsentVersion) => {
    setError(null);
    try {
      const state = await initLiff();

      if (state.isConfigured) {
        if (!state.isLoggedIn) {
          if (!storePendingLegalConsent(legalConsentVersion)) {
            throw new Error(
              "規約への同意情報を保存できませんでした。ブラウザ設定を確認して、もう一度お試しください。",
            );
          }
          setError("LINEログイン画面を開いています。画面が変わらない場合は、LINE内で開き直してください。");
          await loginWithLiff();
          return "redirecting";
        }
        const idToken = await getLiffIdToken();
        if (!idToken) throw new Error("LINE ID token を取得できませんでした");
        setMe(await createLineSession(idToken, legalConsentVersion));
        clearPendingLegalConsent();
        setIsLoginModalOpen(false);
        return "authenticated";
      }

      throw new Error("LIFF ID が設定されていません。");
    } catch (caught) {
      const message = loginErrorMessage(caught);
      setError(message);
      throw new Error(message);
    }
  }, []);

  const logout = useCallback(async () => {
    let response: Response;
    try {
      response = await fetch("/api/auth/line/session", { method: "DELETE" });
    } catch {
      return { status: "failed", appSession: "failed", liffSession: "not_attempted" } as const;
    }
    if (!response.ok) {
      return { status: "failed", appSession: "failed", liffSession: "not_attempted" } as const;
    }
    let liffSession: "ended" | "failed" = "ended";
    try {
      await logoutFromLiff();
    } catch {
      liffSession = "failed";
    }
    clearPendingLegalConsent();
    setMe(null);
    return liffSession === "ended"
      ? { status: "success", appSession: "ended", liffSession } as const
      : { status: "partial", appSession: "ended", liffSession } as const;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const state = await initLiff();
        if (cancelled) return;

        if (state.isConfigured && state.isLoggedIn) {
          const currentMe = await fetchMe();
          if (currentMe) {
            setMe(currentMe);
            clearPendingLegalConsent();
          } else {
            const legalConsentVersion = readPendingLegalConsent();
            if (legalConsentVersion) {
              const idToken = await getLiffIdToken();
              if (idToken) {
                setMe(await createLineSession(idToken, legalConsentVersion));
                clearPendingLegalConsent();
              }
            }
          }
        } else {
          setMe(await fetchMe());
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "認証状態の確認に失敗しました");
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      isLoggedIn: Boolean(me),
      openLoginModal: () => setIsLoginModalOpen(true),
      closeLoginModal: () => setIsLoginModalOpen(false),
      isLoginModalOpen,
      login,
      logout,
      hydrated,
      error,
      me,
      refreshMe,
    }),
    [error, hydrated, isLoginModalOpen, login, logout, me, refreshMe],
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
