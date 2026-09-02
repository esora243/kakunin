import assert from "node:assert/strict";
import test from "node:test";
import { readRequiredApiJson } from "../lib/api-client";

test("readRequiredApiJson returns typed success JSON", async () => {
  const response = Response.json({ ok: true, item: { id: "item-1" } });

  const data = await readRequiredApiJson<{ ok: true; item: { id: string } }>(response, "fallback");

  assert.deepEqual(data, { ok: true, item: { id: "item-1" } });
});

test("readRequiredApiJson uses API error messages when present", async () => {
  const response = Response.json({ ok: false, error: { message: "specific failure" } }, { status: 400 });

  await assert.rejects(
    () => readRequiredApiJson(response, "fallback"),
    /specific failure/,
  );
});

test("readRequiredApiJson falls back for malformed or missing error JSON", async () => {
  const response = new Response("not json", { status: 500 });

  await assert.rejects(
    () => readRequiredApiJson(response, "fallback failure"),
    /fallback failure/,
  );
});

test("readRequiredApiJson can include HTTP status for non-JSON edge failures", async () => {
  const response = new Response("blocked at edge", { status: 403 });

  await assert.rejects(
    () => readRequiredApiJson(response, "登録に失敗しました", { includeStatusInFallback: true }),
    /登録に失敗しました（HTTP 403）/,
  );
});
