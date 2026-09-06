import { adminApiRoute } from "@/lib/api-route";
import { createActivity, pickActivityInputFields } from "@/lib/activities";
import { dbTransaction } from "@/lib/db/postgres";
import { ValidationError } from "@/lib/errors";

export const POST = adminApiRoute("owner", async (identity, request) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") throw new ValidationError("Request body must be a JSON object", "invalid_body");
  const activity = await dbTransaction((client) =>
    createActivity(client, pickActivityInputFields(body as Record<string, unknown>), identity.adminId),
  );
  return { activity, cacheWarning: false };
});
