import assert from "node:assert/strict";
import test from "node:test";
import { HttpError } from "../lib/errors";
import { readOptionalJsonObject } from "../lib/optional-json-object";

test("optional publish JSON preserves missing and whitespace-only immediate publish bodies", async () => {
  assert.deepEqual(await readOptionalJsonObject(new Request("https://admin.test/publish", { method: "POST" })), {});
  assert.deepEqual(
    await readOptionalJsonObject(new Request("https://admin.test/publish", { method: "POST", body: "  \n" })),
    {},
  );
});

test("optional publish JSON accepts only JSON objects", async () => {
  const valid = new Request("https://admin.test/publish", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ scheduledAt: "2026-08-25T00:00:00.000Z" }),
  });
  assert.deepEqual(await readOptionalJsonObject(valid), { scheduledAt: "2026-08-25T00:00:00.000Z" });

  for (const body of ["null", "[]", '"now"', "1", "true"]) {
    await assert.rejects(
      readOptionalJsonObject(new Request("https://admin.test/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      })),
      (error: unknown) => error instanceof HttpError && error.status === 400 && error.code === "invalid_json_object",
    );
  }
});

test("optional publish JSON classifies malformed, unsupported, and oversized bodies", async () => {
  await assert.rejects(
    readOptionalJsonObject(new Request("https://admin.test/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    })),
    (error: unknown) => error instanceof HttpError && error.status === 400 && error.code === "invalid_json",
  );
  await assert.rejects(
    readOptionalJsonObject(new Request("https://admin.test/publish", { method: "POST", body: "{}" })),
    (error: unknown) => error instanceof HttpError && error.status === 415,
  );
  await assert.rejects(
    readOptionalJsonObject(new Request("https://admin.test/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(100) }),
    }), 16),
    (error: unknown) => error instanceof HttpError && error.status === 413,
  );
});
