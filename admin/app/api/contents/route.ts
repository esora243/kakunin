import { adminApiRoute } from "@/lib/api-route";
import { dbTransaction } from "@/lib/db/postgres";
import { createContent, listContentRows, pickContentInputFields } from "@/lib/contents";
import { ValidationError } from "@/lib/errors";
import type { ContentInput } from "@/lib/content-dto";

export const GET = adminApiRoute("any", async (_identity, request) => {
  const url = new URL(request.url);
  const rows = await listContentRows({
    q: url.searchParams.get("q") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    state: url.searchParams.get("state") ?? undefined,
  });
  return { contents: rows };
});

export const POST = adminApiRoute("any", async (identity, request) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    throw new ValidationError("Request body must be a JSON object", "invalid_body");
  }
  const input = pickContentInputFields(body) as ContentInput;

  const row = await dbTransaction((client) => createContent(client, input, identity.adminId));

  // New drafts are not publicly visible, so create never needs cache invalidation.
  return { content: row, cacheWarning: false };
});
