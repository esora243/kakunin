export type AdminRole = "owner" | "editor";

export type AdminIdentity = {
  adminId: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
};

export class AdminAuthError extends Error {
  readonly code:
    | "config_missing"
    | "email_unverified"
    | "session_invalid"
    | "upstream_unavailable"
    | "local_bypass_not_allowed";

  constructor(message: string, code: AdminAuthError["code"]) {
    super(message);
    this.name = "AdminAuthError";
    this.code = code;
  }
}

export function adminAuthErrorStatus(error: AdminAuthError): 403 | 503 {
  return error.code === "config_missing" || error.code === "upstream_unavailable" ? 503 : 403;
}

export function adminAuthPublicMessage(error: AdminAuthError): string {
  return error.code === "config_missing" || error.code === "upstream_unavailable"
    ? "Admin authentication is temporarily unavailable"
    : "Admin identity could not be verified";
}
