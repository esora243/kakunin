import { ConflictError, ValidationError } from "./errors";

// Single publishing model shared across domains, per
// docs/admin-management-app-spec.md "Publishing Semantics":
//   is_active=false            -> hidden/deactivated
//   published_at is null       -> draft/workflow state
//   published_at <= now() && is_active=true -> visible

export type PublishState = "draft" | "review" | "approved" | "scheduled" | "published" | "deactivated";

export function publishStateOf(row: { is_active: boolean; published_at: string | null; approval_status?: string | null }): PublishState {
  if (!row.is_active) return "deactivated";
  if (row.published_at) {
    return new Date(row.published_at).getTime() <= Date.now() ? "published" : "scheduled";
  }
  if (row.approval_status === "in_review") return "review";
  if (row.approval_status === "approved") return "approved";
  return "draft";
}

export function isPubliclyVisible(row: { is_active: boolean; published_at: string | null }): boolean {
  return publishStateOf(row) === "published";
}

export function assertApprovalStatusMutable(row: { is_active: boolean; published_at: string | null }): void {
  if (row.published_at) {
    throw new ConflictError(
      "Approval status cannot be changed after content is published or scheduled",
      "approval_status_locked",
    );
  }
}

export function parseScheduledAt(value: unknown): Date {
  if (value === null || value === undefined || value === "") return new Date();
  if (typeof value !== "string") throw new ValidationError("scheduledAt must be a valid date/time", "invalid_schedule");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ValidationError("scheduledAt must be a valid date/time", "invalid_schedule");
  return date;
}
