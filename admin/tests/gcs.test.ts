import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  assertManagedPublicAssetReadable,
  buildResponsiveImageVariants,
  isNotFoundStorageError,
  probePublicUrl,
} from "../lib/gcs";

test("isNotFoundStorageError recognizes the storage 404 shapes we need to treat as idempotent", () => {
  assert.equal(isNotFoundStorageError({ code: 404 }), true);
  assert.equal(isNotFoundStorageError({ statusCode: 404 }), true);
  assert.equal(isNotFoundStorageError({ code: 500 }), false);
  assert.equal(isNotFoundStorageError(new Error("boom")), false);
});

for (const status of [403, 404, 500]) {
  test(`probePublicUrl classifies HTTP ${status} without hiding it as a generic failure`, async () => {
    const result = await probePublicUrl("https://app.example/asset", {
      fetchImpl: async () => new Response(null, { status }),
    });
    assert.deepEqual(result, { status: "http_error", httpStatus: status });
  });
}

test("probePublicUrl classifies successful delivery", async () => {
  const result = await probePublicUrl("https://app.example/asset", {
    fetchImpl: async () => new Response(null, { status: 200 }),
  });
  assert.deepEqual(result, { status: "readable", httpStatus: 200 });
});

test("probePublicUrl classifies network failures", async () => {
  const result = await probePublicUrl("https://app.example/asset", {
    fetchImpl: async () => { throw new TypeError("network unavailable"); },
  });
  assert.deepEqual(result, { status: "network_error" });
});

test("probePublicUrl aborts and classifies a bounded timeout", async () => {
  const result = await probePublicUrl("https://app.example/asset", {
    timeoutMs: 5,
    fetchImpl: (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }),
  });
  assert.deepEqual(result, { status: "timeout" });
});

test("managed public assets fail closed when public delivery is unreadable", async () => {
  const env = { ...process.env, GCS_PUBLIC_ASSET_BASE_URL: "https://app.example/api/assets/public" };
  await assert.rejects(
    assertManagedPublicAssetReadable(
      "https://app.example/api/assets/public/contents/hero.webp",
      { env, fetchImpl: async () => new Response(null, { status: 403 }) },
    ),
    (error: unknown) =>
      error instanceof Error &&
      "status" in error &&
      error.status === 400 &&
      "code" in error &&
      error.code === "managed_asset_unreadable",
  );
});

for (const failure of [
  { name: "HTTP 500", fetchImpl: async () => new Response(null, { status: 500 }) },
  { name: "network failure", fetchImpl: async () => { throw new TypeError("network unavailable"); } },
] as const) {
  test(`managed public asset ${failure.name} is reported as temporarily unavailable`, async () => {
    const env = { ...process.env, GCS_PUBLIC_ASSET_BASE_URL: "https://app.example/api/assets/public" };
    await assert.rejects(
      assertManagedPublicAssetReadable(
        "https://app.example/api/assets/public/contents/hero.webp",
        { env, fetchImpl: failure.fetchImpl },
      ),
      (error: unknown) =>
        error instanceof Error &&
        "status" in error &&
        error.status === 503 &&
        "code" in error &&
        error.code === "asset_probe_unavailable",
    );
  });
}

test("managed public asset probe timeout is reported as temporarily unavailable", async () => {
  const env = { ...process.env, GCS_PUBLIC_ASSET_BASE_URL: "https://app.example/api/assets/public" };
  await assert.rejects(
    assertManagedPublicAssetReadable(
      "https://app.example/api/assets/public/contents/hero.webp",
      {
        env,
        timeoutMs: 5,
        fetchImpl: (_input, init) => new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
      },
    ),
    (error: unknown) =>
      error instanceof Error &&
      "status" in error &&
      error.status === 503 &&
      "code" in error &&
      error.code === "asset_probe_unavailable",
  );
});

test("external hero URLs are outside the managed readability gate", async () => {
  const env = { ...process.env, GCS_PUBLIC_ASSET_BASE_URL: "https://app.example/api/assets/public" };
  let fetched = false;
  await assertManagedPublicAssetReadable("https://cdn.example/hero.webp", {
    env,
    fetchImpl: async () => {
      fetched = true;
      throw new Error("must not probe arbitrary URLs");
    },
  });
  assert.equal(fetched, false);
});

test("responsive generation emits bounded WebP and AVIF renditions without upscaling", async () => {
  const source = await sharp({
    create: { width: 700, height: 350, channels: 3, background: "#336699" },
  }).png().toBuffer();
  const variants = await buildResponsiveImageVariants(source, 700);

  assert.deepEqual(
    variants.map((variant) => `${variant.width}:${variant.contentType}`),
    [
      "320:image/webp",
      "320:image/avif",
      "640:image/webp",
      "640:image/avif",
      "700:image/webp",
      "700:image/avif",
    ],
  );
  assert.ok(variants.every((variant) => variant.height > 0 && variant.byteSize > 0));
  assert.ok(variants.every((variant) => /^[0-9a-f]{64}$/.test(variant.checksum)));
});
