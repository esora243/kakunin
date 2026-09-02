import assert from "node:assert/strict";
import test from "node:test";
import { LineTokenVerifyError, verifyLineIdToken } from "../lib/auth/line";

test("verifyLineIdToken fails when LINE_CHANNEL_ID is missing", async () => {
  await assert.rejects(
    () => verifyLineIdToken({ idToken: "token", channelId: "" }),
    (error) => error instanceof LineTokenVerifyError && error.code === "line_channel_id_missing",
  );
});

test("verifyLineIdToken fails when verify API rejects the token", async () => {
  await assert.rejects(
    () =>
      verifyLineIdToken({
        idToken: "bad-token",
        channelId: "channel",
        fetchImpl: async () => new Response("bad", { status: 400 }),
      }),
    (error) => error instanceof LineTokenVerifyError && error.code === "line_token_invalid" && error.httpStatus === 401,
  );
});

test("verifyLineIdToken treats 401 verify responses as invalid tokens", async () => {
  await assert.rejects(
    () =>
      verifyLineIdToken({
        idToken: "bad-token",
        channelId: "channel",
        fetchImpl: async () => new Response("bad", { status: 401 }),
      }),
    (error) => error instanceof LineTokenVerifyError && error.code === "line_token_invalid" && error.httpStatus === 401,
  );
});

test("verifyLineIdToken preserves LINE rate limit classification", async () => {
  await assert.rejects(
    () =>
      verifyLineIdToken({
        idToken: "token",
        channelId: "channel",
        fetchImpl: async () => new Response("limited", { status: 429, headers: { "x-line-request-id": "line-req-1" } }),
      }),
    (error) =>
      error instanceof LineTokenVerifyError &&
      error.code === "line_verify_rate_limited" &&
      error.httpStatus === 429 &&
      error.upstreamStatus === 429 &&
      error.lineRequestId === "line-req-1",
  );
});

test("verifyLineIdToken preserves LINE outage classification", async () => {
  await assert.rejects(
    () =>
      verifyLineIdToken({
        idToken: "token",
        channelId: "channel",
        fetchImpl: async () => new Response("down", { status: 500 }),
      }),
    (error) =>
      error instanceof LineTokenVerifyError &&
      error.code === "line_verify_unavailable" &&
      error.httpStatus === 503 &&
      error.upstreamStatus === 500,
  );
});

test("verifyLineIdToken treats network failures as unavailable", async () => {
  await assert.rejects(
    () =>
      verifyLineIdToken({
        idToken: "token",
        channelId: "channel",
        fetchImpl: async () => {
          throw new Error("network down");
        },
      }),
    (error) => error instanceof LineTokenVerifyError && error.code === "line_verify_unavailable" && error.httpStatus === 503,
  );
});

test("verifyLineIdToken fails when token is expired", async () => {
  await assert.rejects(
    () =>
      verifyLineIdToken({
        idToken: "token",
        channelId: "channel",
        fetchImpl: async () => Response.json({ iss: "https://access.line.me", aud: "channel", sub: "line-user-1", exp: 1 }),
      }),
    (error) => error instanceof LineTokenVerifyError && error.code === "line_token_expired" && error.httpStatus === 401,
  );
});

test("verifyLineIdToken fails when issuer is not LINE", async () => {
  await assert.rejects(
    () =>
      verifyLineIdToken({
        idToken: "token",
        channelId: "channel",
        fetchImpl: async () => Response.json({ iss: "https://example.com", aud: "channel", sub: "line-user-1" }),
      }),
    (error) => error instanceof LineTokenVerifyError && error.code === "line_token_issuer_mismatch",
  );
});

test("verifyLineIdToken rejects oversized token payloads before upstream verification", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      verifyLineIdToken({
        idToken: "x".repeat(4097),
        channelId: "channel",
        fetchImpl: async () => {
          calls += 1;
          return Response.json({ iss: "https://access.line.me", aud: "channel", sub: "line-user-1" });
        },
      }),
    (error) => error instanceof LineTokenVerifyError && error.code === "line_token_invalid",
  );
  assert.equal(calls, 0);
});

test("verifyLineIdToken fails when sub is missing", async () => {
  await assert.rejects(
    () =>
      verifyLineIdToken({
        idToken: "token",
        channelId: "channel",
        fetchImpl: async () => Response.json({ iss: "https://access.line.me", aud: "channel" }),
      }),
    (error) => error instanceof LineTokenVerifyError && error.code === "line_token_subject_missing",
  );
});
