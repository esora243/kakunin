import type { AdminContentRow } from "./content-dto";
import type { AdminIdentity } from "./auth/types";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import type { PublishState } from "./publishing";

export type ContentApprovalStatus = AdminContentRow["approval_status"];
export type ContentApprovalTransitionStatus = Extract<ContentApprovalStatus, "in_review" | "approved" | "changes_requested">;

export const CONTENT_STATE_OPTIONS: PublishState[] = [
  "draft",
  "review",
  "approved",
  "scheduled",
  "published",
  "deactivated",
];

export const CONTENT_DRAFT_APPROVAL_STATUSES: ContentApprovalStatus[] = ["draft", "changes_requested"];

export function assertContentApprovalTransitionAllowed(
  identity: Pick<AdminIdentity, "role">,
  status: unknown,
): asserts status is ContentApprovalTransitionStatus {
  if (status !== "in_review" && status !== "approved" && status !== "changes_requested") {
    throw new ValidationError("Invalid approval status", "invalid_approval_status");
  }
  if ((status === "approved" || status === "changes_requested") && identity.role !== "owner") {
    throw new ForbiddenError("Only owners can approve content or request changes", "owner_approval_required");
  }
}

export function assertContentSlugChangeAllowed(
  identity: Pick<AdminIdentity, "role">,
  row: Pick<AdminContentRow, "published_at" | "first_published_at">,
  confirmSlugChange: unknown,
): void {
  if (!row.first_published_at && !row.published_at) return;
  if (identity.role !== "owner") {
    throw new ForbiddenError("Changing a published content's slug is owner-only", "forbidden");
  }
  if (confirmSlugChange !== true) {
    throw new ValidationError(
      "Changing the slug of a published content requires confirmSlugChange: true. Note: the launch release does not auto-redirect old slugs.",
      "slug_change_confirmation_required",
    );
  }
}

export type ReactivateContentDependencies = {
  getContentRowById: (id: string) => Promise<AdminContentRow | null>;
  assertBeforeReactivate?: (current: AdminContentRow) => Promise<void>;
  setActiveWithInvalidation: (id: string, actorAdminId: string, current: AdminContentRow) => Promise<{ after: AdminContentRow; cacheResult: { ok: boolean } }>;
};

export async function reactivateContent(
  identity: Pick<AdminIdentity, "adminId">,
  id: string,
  dependencies: ReactivateContentDependencies,
): Promise<{ content: AdminContentRow; cacheWarning: boolean }> {
  const current = await dependencies.getContentRowById(id);
  if (!current) throw new NotFoundError("Content not found");
  await dependencies.assertBeforeReactivate?.(current);

  const { after, cacheResult } = await dependencies.setActiveWithInvalidation(id, identity.adminId, current);
  return { content: after, cacheWarning: !cacheResult.ok };
}
