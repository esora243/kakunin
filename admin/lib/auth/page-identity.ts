import "server-only";

import { cache } from "react";
import { accessSourceFromNextRequestContext } from "./access";
import { resolveAdminIdentity } from "./admin-session";
import type { AdminIdentity } from "./types";
import { AdminAuthError } from "./types";

const cacheForReact = typeof cache === "function" ? cache : <T extends (...args: never[]) => unknown>(fn: T) => fn;

/**
 * Resolves the current admin identity for Server Components. Wrapped in
 * React's cache() so multiple layouts/pages in one render only resolve once.
 * Returns null (never throws) so pages can render an access-denied state
 * instead of a generic error boundary.
 */
export const getAdminIdentityForPage = cacheForReact(async (): Promise<AdminIdentity | null> => {
  try {
    const source = await accessSourceFromNextRequestContext();
    return await resolveAdminIdentity(source);
  } catch (error) {
    if (error instanceof AdminAuthError && error.code !== "config_missing") return null;
    throw error;
  }
});
