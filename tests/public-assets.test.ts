import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedPublicAssetContentType, normalizePublicAssetObjectPath } from "../lib/public-assets";
import { contentListImageUrl } from "../lib/contents";

test("public assets allow generated AVIF renditions", () => {
  assert.equal(isAllowedPublicAssetContentType("image/avif"), true);
});

test("Content lists select the 640px rendition without inventing an unavailable upscale", () => {
  assert.equal(
    contentListImageUrl("https://app.hugmeid.com/api/assets/public/contents/variants/2a10d9aa-b7cf-4ca7-9d16-d809d8f67f59/w1280.webp"),
    "https://app.hugmeid.com/api/assets/public/contents/variants/2a10d9aa-b7cf-4ca7-9d16-d809d8f67f59/w640.webp",
  );
  assert.equal(
    contentListImageUrl("https://app.hugmeid.com/api/assets/public/contents/variants/2a10d9aa-b7cf-4ca7-9d16-d809d8f67f59/w480.webp"),
    "https://app.hugmeid.com/api/assets/public/contents/variants/2a10d9aa-b7cf-4ca7-9d16-d809d8f67f59/w480.webp",
  );
  assert.equal(contentListImageUrl("https://images.example.com/w1280.webp"), "https://images.example.com/w1280.webp");
});

test("public asset paths are constrained to generated contents objects", () => {
  assert.equal(normalizePublicAssetObjectPath(["contents", "image.jpg"]), "contents/image.jpg");
  assert.equal(normalizePublicAssetObjectPath(["contents", "nested", "image.webp"]), "contents/nested/image.webp");

  assert.equal(normalizePublicAssetObjectPath([]), null);
  assert.equal(normalizePublicAssetObjectPath(["contents"]), null);
  assert.equal(normalizePublicAssetObjectPath(["jobs", "image.jpg"]), null);
  assert.equal(normalizePublicAssetObjectPath(["contents", "..", "secret.jpg"]), null);
  assert.equal(normalizePublicAssetObjectPath(["contents", "", "secret.jpg"]), null);
  assert.equal(normalizePublicAssetObjectPath(["contents", "bad\\path.jpg"]), null);
});

test("public asset responses only serve sanitized image content types", () => {
  assert.equal(isAllowedPublicAssetContentType("image/jpeg"), true);
  assert.equal(isAllowedPublicAssetContentType("image/png; charset=binary"), true);
  assert.equal(isAllowedPublicAssetContentType("IMAGE/WEBP"), true);

  assert.equal(isAllowedPublicAssetContentType(undefined), false);
  assert.equal(isAllowedPublicAssetContentType("image/svg+xml"), false);
  assert.equal(isAllowedPublicAssetContentType("text/html"), false);
  assert.equal(isAllowedPublicAssetContentType("application/octet-stream"), false);
});
