import { adminApiRoute } from "@/lib/api-route";
import { mutateWithPublicCacheInvalidation } from "@/lib/cache-invalidate";
import { pickSyllabusPagePatch, updateSyllabusPage } from "@/lib/school";
import { ValidationError } from "@/lib/errors";
import { requireUuidParam } from "@/lib/query-params";

function idFromUrl(request: Request): string {
  return requireUuidParam(new URL(request.url).pathname.split("/").at(-1), "School id");
}

export const PATCH = adminApiRoute("owner", async (identity, request) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") throw new ValidationError("Request body must be a JSON object", "invalid_body");
  const id = idFromUrl(request);
  const { value: { after }, cacheResult } = await mutateWithPublicCacheInvalidation(
    identity.adminId, (client) => updateSyllabusPage(client, id, pickSyllabusPagePatch(body as Record<string, unknown>), identity.adminId),
    { resourceType: "syllabus_pages", resourceId: id, tags: ["timetable"] },
  );
  return { page: after, cacheWarning: !cacheResult.ok };
});
