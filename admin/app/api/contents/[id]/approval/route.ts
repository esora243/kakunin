import { adminApiRoute } from "@/lib/api-route";
import { dbTransaction } from "@/lib/db/postgres";
import { assertContentApprovalTransitionAllowed } from "@/lib/content-workflow";
import { setApprovalStatus } from "@/lib/contents";
import { ValidationError } from "@/lib/errors";
import { requireUuidParam } from "@/lib/query-params";

function contentIdFromRequest(request: Request): string {
  const segments = new URL(request.url).pathname.split("/");
  return requireUuidParam(segments[segments.length - 2], "Content id");
}

export const POST = adminApiRoute("any", async (identity, request) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") throw new ValidationError("Request body must be a JSON object", "invalid_body");
  const status = (body as Record<string, unknown>).status;
  assertContentApprovalTransitionAllowed(identity, status);
  const id = contentIdFromRequest(request);
  const { after } = await dbTransaction((client) => setApprovalStatus(client, id, status, identity.adminId));
  return { content: after };
});
