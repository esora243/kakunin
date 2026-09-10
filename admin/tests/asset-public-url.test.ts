import assert from "node:assert/strict";
import test from "node:test";
import { isManagedPublicAssetUrl, publicAssetUrlFor } from "../lib/asset-public-url";

test("publicAssetUrlFor fails before any upload write can rely on a missing public proxy base URL", () => {
  const env = { ...process.env };
  delete env.GCS_PUBLIC_ASSET_BASE_URL;

  assert.throws(
    () => publicAssetUrlFor("contents/example.webp", env),
    /GCS_PUBLIC_ASSET_BASE_URL is not configured/,
  );
});

test("publicAssetUrlFor builds URLs against the configured proxy base", () => {
  const env = {
    ...process.env,
    GCS_PUBLIC_ASSET_BASE_URL: "https://app.hugmeid.com/api/assets/public/",
  };

  assert.equal(
    publicAssetUrlFor("contents/example.webp", env),
    "https://app.hugmeid.com/api/assets/public/contents/example.webp",
  );
});

test("isManagedPublicAssetUrl accepts only HTTPS URLs beneath the configured proxy path", () => {
  const env = { ...process.env, GCS_PUBLIC_ASSET_BASE_URL: "https://app.hugmeid.com/api/assets/public" };
  assert.equal(isManagedPublicAssetUrl("https://app.hugmeid.com/api/assets/public/contents/hero.webp", env), true);
  assert.equal(isManagedPublicAssetUrl("https://app.hugmeid.com/api/assets/other/hero.webp", env), false);
  assert.equal(isManagedPublicAssetUrl("https://evil.example/api/assets/public/contents/hero.webp", env), false);
  assert.equal(isManagedPublicAssetUrl("http://app.hugmeid.com/api/assets/public/contents/hero.webp", env), false);
});
