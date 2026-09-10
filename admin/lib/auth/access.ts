import { resolveDatabaseRuntimeEnvironment } from "../db/environment";
import { AdminAuthError } from "./types";

export type AccessSource = {
  getHeader(name: string): string | null;
  getCookie(name: string): string | null;
};

let nextRequestAccessSourceForTests: AccessSource | null = null;

export function setNextRequestAccessSourceForTests(source: AccessSource | null): void {
  nextRequestAccessSourceForTests = source;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length > 0 ? email : null;
}

export function accessSourceFromRequest(request: Request): AccessSource {
  return {
    getHeader: (name) => request.headers.get(name),
    getCookie: (name) => {
      const cookieHeader = request.headers.get("cookie");
      if (!cookieHeader) return null;
      const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
      for (const cookie of cookies) {
        const separator = cookie.indexOf("=");
        if (separator <= 0) continue;
        if (cookie.slice(0, separator) === name) {
          return decodeURIComponent(cookie.slice(separator + 1));
        }
      }
      return null;
    },
  };
}

export async function accessSourceFromNextRequestContext(): Promise<AccessSource> {
  if (nextRequestAccessSourceForTests) return nextRequestAccessSourceForTests;

  const { cookies, headers } = await import("next/headers");
  const headerStore = await headers();
  const cookieStore = await cookies();
  return {
    getHeader: (name) => headerStore.get(name),
    getCookie: (name) => cookieStore.get(name)?.value ?? null,
  };
}

function isLocalDeploy(): boolean {
  try {
    return resolveDatabaseRuntimeEnvironment().deployEnv === "local";
  } catch {
    return false;
  }
}

export function localBypassEmail(): string | undefined {
  const value = process.env.ADMIN_LOCAL_AUTH_BYPASS_EMAIL?.trim();
  if (!value) return undefined;
  if (!isLocalDeploy()) {
    throw new AdminAuthError("ADMIN_LOCAL_AUTH_BYPASS_EMAIL must not be set outside local development", "local_bypass_not_allowed");
  }
  return normalizeEmail(value) ?? undefined;
}
