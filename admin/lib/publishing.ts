import { ValidationError } from "./errors";

// Single publishing model shared across domains, per
// docs/admin-management-app-spec.md "Publishing Semantics":
//   is_active=false            -> hidden/deactivated
//   published_at is null       -> draft
//   published_at <= now() && is_active=true -> visible
//
// The former approval workflow (draft -> in_review -> approved) has been
// removed: any admin with write access can publish directly. The
// `approval_status` column still exists in the database for compatibility
// with the public app, but it is no longer read or written here.

export type PublishState = "draft" | "scheduled" | "published" | "deactivated";

export function publishStateOf(row: { is_active: boolean; published_at: string | null }): PublishState {
  if (!row.is_active) return "deactivated";
  if (row.published_at) {
    return new Date(row.published_at).getTime() <= Date.now() ? "published" : "scheduled";
  }
  return "draft";
}

export function isPubliclyVisible(row: { is_active: boolean; published_at: string | null }): boolean {
  return publishStateOf(row) === "published";
}

export function parseScheduledAt(value: unknown): Date {
  if (value === null || value === undefined || value === "") return new Date();
  if (typeof value !== "string") throw new ValidationError("scheduledAt must be a valid date/time", "invalid_schedule");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ValidationError("scheduledAt must be a valid date/time", "invalid_schedule");
  return date;
}
