import { adminApiRoute } from "@/lib/api-route";
import { dbTransaction } from "@/lib/db/postgres";
import { writeAuditLog } from "@/lib/audit";
import { updateInquiryStatus } from "@/lib/inquiries";
import type { InquiryStatus } from "@/lib/inquiries";
import { ValidationError } from "@/lib/errors";
import { requireUuidParam } from "@/lib/query-params";

const VALID_STATUSES: InquiryStatus[] = ["open", "in_progress", "closed"];

function resolveInquiryIdFromRequest(request: Request): string {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  // .../api/inquiries/[id]/status -> id is second to last segment.
  return requireUuidParam(segments[segments.length - 2], "Inquiry id");
}

type StatusUpdateBody = {
  fromStatus?: unknown;
  toStatus?: unknown;
  confirmReopen?: unknown;
};

// Owner-only status update, per docs/admin-management-app-spec.md
// "Inquiries" > "Launch permissions" ("Editors cannot update inquiry
// status"). The reopen transition (closed -> in_progress) additionally
// requires explicit confirmation from the UI, per "Allowed transitions":
// "closed -> in_progress only when reopening is explicitly confirmed".
export const PATCH = adminApiRoute("owner", async (identity, request) => {
  const id = resolveInquiryIdFromRequest(request);
  const body = (await request.json().catch(() => ({}))) as StatusUpdateBody;

  const fromStatus = body.fromStatus;
  const toStatus = body.toStatus;

  if (!VALID_STATUSES.includes(fromStatus as InquiryStatus) || !VALID_STATUSES.includes(toStatus as InquiryStatus)) {
    throw new ValidationError("fromStatus and toStatus must be valid inquiry statuses");
  }

  if (fromStatus === "closed" && toStatus === "in_progress" && body.confirmReopen !== true) {
    throw new ValidationError(
      "Reopening a closed inquiry requires explicit confirmation (confirmReopen: true)",
      "confirm_reopen_required",
    );
  }

  const updated = await dbTransaction(async (client) => {
    const result = await updateInquiryStatus(
      client,
      id,
      fromStatus as InquiryStatus,
      toStatus as InquiryStatus,
    );

    // Before/after snapshots deliberately contain only status, never the
    // message body, per spec's "Audit logs must avoid storing full inquiry
    // message bodies unless required for a specific incident review."
    await writeAuditLog(client, {
      actorAdminId: identity.adminId,
      action: "inquiry.status_update",
      resourceType: "inquiries",
      resourceId: id,
      beforeSnapshot: { status: fromStatus },
      afterSnapshot: { status: toStatus },
    });

    return result;
  });

  return { inquiry: updated };
});
