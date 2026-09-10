import { ForbiddenError } from "./errors";
import type { AdminIdentity } from "./auth/types";

export function isOwner(identity: AdminIdentity): boolean {
  return identity.role === "owner";
}

export function assertOwner(identity: AdminIdentity, message = "This action is owner-only"): void {
  if (!isOwner(identity)) throw new ForbiddenError(message);
}

/** Owners cannot demote or deactivate their own admin_users row. */
export function assertNotActingOnSelf(identity: AdminIdentity, targetAdminId: string, message: string): void {
  if (identity.adminId === targetAdminId) throw new ForbiddenError(message);
}
