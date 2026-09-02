import { adminApiRoute } from "@/lib/api-route";
import { dbTransaction } from "@/lib/db/postgres";
import { createJob, pickJobInputFields } from "@/lib/jobs";
import { ValidationError } from "@/lib/errors";

export const POST = adminApiRoute("owner", async (identity, request) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") throw new ValidationError("Request body must be a JSON object", "invalid_body");
  const job = await dbTransaction((client) =>
    createJob(client, pickJobInputFields(body as Record<string, unknown>), identity.adminId),
  );
  return { job, cacheWarning: false };
});
