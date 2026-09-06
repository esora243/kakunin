import assert from "node:assert/strict";
import test from "node:test";
import { requireExpectedUpdatedAt, timestampsMatch } from "../lib/concurrency";

test("expectedUpdatedAt accepts a valid timestamptz spelling", () => {
  assert.equal(requireExpectedUpdatedAt("2026-08-21T09:00:00+09:00"), "2026-08-21T09:00:00+09:00");
  assert.equal(requireExpectedUpdatedAt("2026-08-21 00:00:00.123456+00"), "2026-08-21 00:00:00.123456+00");
});

test("expectedUpdatedAt rejects normalized invalid calendar dates before PostgreSQL", () => {
  assert.throws(
    () => requireExpectedUpdatedAt("2026-02-30T00:00:00+00:00"),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "invalid_expected_updated_at",
  );
});

test("timestamp comparison is delegated to PostgreSQL without losing precision", async () => {
  const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
  const client = {
    query: async (text: string, values?: readonly unknown[]) => {
      calls.push({ text, values });
      return { rows: [{ matches: true }] };
    },
  } as never;
  assert.equal(await timestampsMatch(client, "2026-08-21 00:00:00.123456+00", "2026-08-21T09:00:00.123456+09:00"), true);
  assert.match(calls[0]?.text ?? "", /::timestamptz/);
  assert.deepEqual(calls[0]?.values, ["2026-08-21 00:00:00.123456+00", "2026-08-21T09:00:00.123456+09:00"]);
});
