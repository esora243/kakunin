"use client";

import type { Liff } from "@line/liff";

let liffPromise: Promise<Liff> | null = null;
let sdkInitPromise: Promise<Liff> | null = null;
const LIFF_LOGIN_PENDING_KEY = "hugmeid.liff.login-pending";

export type LiffState = {
  isConfigured: boolean;
  isLoggedIn: boolean;
};

async function loadLiff() {
  if (!liffPromise) {
    liffPromise = import("@line/liff")
      .then((module) => module.default)
      .catch((error) => {
        liffPromise = null;
        throw error;
      });
  }
  return liffPromise;
}

async function initializeLiffSdk() {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId) throw new Error("LIFF ID が設定されていません。");

  if (!sdkInitPromise) {
    sdkInitPromise = loadLiff()
      .then(async (liff) => {
        await liff.init({ liffId });
        return liff;
      })
      .catch((error) => {
        sdkInitPromise = null;
        throw error;
      });
  }
  return sdkInitPromise;
}

function getCurrentUrlParams() {
  if (typeof window === "undefined") return new URLSearchParams();

  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash.replace(/^#/, "");
  const hashQuery = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : hash;
  if (hashQuery.includes("=")) {
    new URLSearchParams(hashQuery).forEach((value, key) => params.append(key, value));
  }
  return params;
}

function hasPendingLiffLogin() {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(LIFF_LOGIN_PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

function markPendingLiffLogin() {
  try {
    window.sessionStorage.setItem(LIFF_LOGIN_PENDING_KEY, "1");
  } catch {
    // Callback parameters still provide the normal initialization signal.
  }
}

function clearPendingLiffLogin() {
  try {
    window.sessionStorage.removeItem(LIFF_LOGIN_PENDING_KEY);
  } catch {
    // A blocked storage API does not invalidate a completed LIFF initialization.
  }
}

function shouldInitializeLiffImmediately() {
  if (typeof window === "undefined") return false;
  if (/Line\//i.test(window.navigator.userAgent)) return true;
  if (hasPendingLiffLogin()) return true;

  const params = getCurrentUrlParams();
  for (const key of params.keys()) {
    if (key.startsWith("liff.")) return true;
  }
  return params.has("access_token") || params.has("lineAppVersion") || (params.has("code") && params.has("state"));
}

export async function initLiff(): Promise<LiffState> {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId) {
    return { isConfigured: false, isLoggedIn: false };
  }

  // Once the SDK is initialized, always read its current authentication state.
  // `isLoggedIn` changes after logout/login and must never be promise-cached.
  if (!sdkInitPromise && !shouldInitializeLiffImmediately()) {
    return { isConfigured: true, isLoggedIn: false };
  }

  let liff: Liff;
  try {
    liff = await initializeLiffSdk();
  } catch (error) {
    clearPendingLiffLogin();
    throw error;
  }
  clearPendingLiffLogin();
  return {
    isConfigured: true,
    isLoggedIn: liff.isLoggedIn(),
  };
}

export async function loginWithLiff() {
  const liff = await initializeLiffSdk();
  markPendingLiffLogin();
  try {
    liff.login({ redirectUri: window.location.href });
  } catch (error) {
    clearPendingLiffLogin();
    throw error;
  }
}

export async function logoutFromLiff() {
  const liff = await initializeLiffSdk();
  if (liff.isLoggedIn()) {
    liff.logout();
  }
}

export async function getLiffIdToken() {
  const liff = await initializeLiffSdk();
  return liff.getIDToken();
}

export async function getLineFriendship() {
  const liff = await initializeLiffSdk();
  if (!liff.isLoggedIn() || typeof liff.getFriendship !== "function") return null;
  return (await liff.getFriendship()).friendFlag;
}

export async function requestLineFriendship() {
  const liff = await initializeLiffSdk();
  if (!liff.isLoggedIn() || typeof liff.requestFriendship !== "function") return false;
  await liff.requestFriendship();
  return true;
}
