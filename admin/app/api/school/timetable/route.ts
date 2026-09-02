import { adminApiRoute } from "@/lib/api-route";
import { dbTransaction } from "@/lib/db/postgres";
import {
  createAdminTimetableEntry,
  listAdminTimetableRows,
  pickAdminTimetableInput,
} from "@/lib/timetable-admin";
import { ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

export const GET = adminApiRoute("any", async (_identity, request) => {
  const url = new URL(request.url);
  const universityId = url.searchParams.get("universityId") ?? undefined;
  const academicYear = url.searchParams.get("academicYear");
  const termNumber = url.searchParams.get("termNumber");
  const rows = await listAdminTimetableRows({
    universityId,
    academicYear: academicYear ? Number(academicYear) : undefined,
    termNumber: termNumber ? Number(termNumber) : undefined,
  });
  return { entries: rows };
});

export const POST = adminApiRoute("any", async (identity, request) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") throw new ValidationError("Request body must be a JSON object", "invalid_body");
  const input = pickAdminTimetableInput(body as Record<string, unknown>);
  const row = await dbTransaction((client) => createAdminTimetableEntry(client, input, identity.adminId));
  return { entry: row };
});
