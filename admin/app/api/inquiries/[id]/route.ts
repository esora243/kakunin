import { adminApiRoute } from "@/lib/api-route";
import { loadInquiryDetailForOwner } from "@/lib/inquiries";
import { ValidationError } from "@/lib/errors";
import { requireUuidParam } from "@/lib/query-params";

function resolveInquiryIdFromRequest(request: Request): string {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  return requireUuidParam(segments[segments.length - 1], "Inquiry id");
}

// Owner-only full detail, per docs/admin-management-app-spec.md "Inquiries"
// > "Launch permissions": editors cannot view message body, contact
// fields, raw user identifiers, or attachments, so this route requires the
// owner role before any inquiry row is fetched. The user_id is masked
// before it ever leaves loadInquiryDetailForOwner, and the read itself is
// audit logged inside that same function ("Owner inquiry detail reads
// should be audit logged").
export const GET = adminApiRoute("owner", async (identity, request) => {
  const id = resolveInquiryIdFromRequest(request);
  if (!id) throw new ValidationError("Inquiry id must be a valid UUID", "invalid_id");
  const detail = await loadInquiryDetailForOwner(identity.adminId, id);
  return { inquiry: detail };
});
