import { adminApiRoute } from "@/lib/api-route";
import { dbTransaction } from "@/lib/db/postgres";
import {
  getAdminTimetableRowById,
  pickAdminTimetableInput,
  softDeleteAdminTimetableEntry,
  updateAdminTimetableEntry,
} from "@/lib/timetable-admin";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { requireUuidParam } from "@/lib/query-params";

function idFromUrl(request: Request): string {
  return requireUuidParam(new URL(request.url).pathname.split("/").at(-1), "Timetable entry id");
}

export const GET = adminApiRoute("any", async (_identity, request) => {
  const id = idFromUrl(request);
  const row = await getAdminTimetableRowById(id);
  if (!row) throw new NotFoundError("Timetable entry not found");
  return { entry: row };
});

export const PATCH = adminApiRoute("any", async (identity, request) => {
  const id = idFromUrl(request);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") throw new ValidationError("Request body must be a JSON object", "invalid_body");
  const input = pickAdminTimetableInput(body as Record<string, unknown>);
  const { after } = await dbTransaction((client) =>
    updateAdminTimetableEntry(client, id, input, identity.adminId),
  );
  return { entry: after };
});

export const DELETE = adminApiRoute("owner", async (identity, request) => {
  const id = idFromUrl(request);
  const after = await dbTransaction((client) => softDeleteAdminTimetableEntry(client, id, identity.adminId));
  return { entry: after };
});
