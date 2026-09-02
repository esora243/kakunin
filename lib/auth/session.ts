import { cookies } from "next/headers";
import {
  createSessionToken,
  isSessionInfrastructureError,
  SessionError,
  SESSION_TTL_SECONDS,
  type ConsentedSessionClaims,
  verifySessionToken,
} from "@/lib/auth/session-token";
import { AUTH_SESSION_COOKIE, SESSION_HINT_COOKIE, SESSION_HINT_VALUE } from "@/lib/auth/session-hint";

export { isSessionInfrastructureError, SessionError } from "@/lib/auth/session-token";

export async function readSessionFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch (error) {
    if (error instanceof SessionError && error.code === "session_invalid") return null;
    throw error;
  }
}

export async function setSessionCookie(payload: ConsentedSessionClaims) {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_SESSION_COOKIE, await createSessionToken(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  // クライアントが「セッションがある」ことだけを知るための非機密ヒント。
  // 認証判断は引き続き httpOnly 側の署名検証で行う。
  cookieStore.set(SESSION_HINT_COOKIE, SESSION_HINT_VALUE, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  cookieStore.set(SESSION_HINT_COOKIE, "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
