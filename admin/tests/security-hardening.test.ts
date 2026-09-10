import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("asset uploads stream multipart data before image processing", () => {
  const route = read("app/api/assets/upload/route.ts");
  const parser = read("lib/upload-request.ts");
  assert.doesNotMatch(route, /request\.formData|arrayBuffer/);
  assert.match(route, /await readImageUpload\(request\)/);
  assert.match(parser, /fileSize:\s*MAX_UPLOAD_BYTES \+ 1/);
  assert.match(parser, /MAX_MULTIPART_BODY_BYTES/);
  assert.match(parser, /reader\.cancel/);
  assert.match(parser, /Promise\.race\(\[reader\.read\(\), parserError\]\)/);
  assert.ok(parser.indexOf('parser.once("error"') < parser.indexOf("while (true)"));
});

test("upload protection combines shared rate limiting and an instance permit", () => {
  const route = read("app/api/assets/upload/route.ts");
  assert.match(route, /await enforceSharedRateLimit/);
  assert.match(route, /const release = acquireUploadPermit\(\)/);
  assert.match(route, /finally\s*{\s*release\(\)/);
  assert.ok(route.indexOf("release();") < route.indexOf("await probePublicUrl"));
  const limiter = read("lib/security/rate-limit.ts");
  assert.match(limiter, /cleanup as \([\s\S]*delete from rate_limit_buckets/);
});

test("admin runtime logs use the safe structured logger", () => {
  for (const path of ["lib/api-route.ts", "lib/gcs.ts", "lib/asset-purge.ts", "lib/cache-invalidate.ts"]) {
    const source = read(path);
    assert.doesNotMatch(source, /console\.error/);
    assert.match(source, /logSafeError/);
  }
  const logger = read("lib/safe-log.ts");
  const fields = logger.match(/export type SafeLogEvent = \{([\s\S]*?)\};/)?.[1] ?? "";
  assert.doesNotMatch(fields, /message|stack|cause|bucket|objectPath|error:/i);
});
test("creating non-public job and activity drafts does not enqueue cache invalidation", () => {
  for (const path of ["app/api/jobs/route.ts", "app/api/activities/route.ts"]) {
    const route = read(path);
    assert.match(route, /dbTransaction/);
    assert.match(route, /cacheWarning:\s*false/);
    assert.doesNotMatch(route, /mutateWithPublicCacheInvalidation|enqueuePublicCacheInvalidation/);
  }
});

test("asset delivery failures stay visible and published managed heroes fail closed", () => {
  const uploadRoute = read("app/api/assets/upload/route.ts");
  const widget = read("app/assets/AssetUploadWidget.tsx");
  const publishRoute = read("app/api/contents/[id]/publish/route.ts");
  const updateRoute = read("app/api/contents/[id]/route.ts");
  const reactivateRoute = read("app/api/contents/[id]/reactivate/route.ts");
  assert.match(uploadRoute, /reason:\s*"public_url_unreadable"/);
  assert.match(uploadRoute, /status:\s*probe\.status/);
  assert.match(widget, /router\.refresh\(\)/);
  assert.doesNotMatch(widget, /window\.location\.reload/);
  assert.doesNotMatch(widget, /反映には少し時間/);
  assert.match(
    publishRoute,
    /assertManagedPublicAssetReadable\(current\.hero_image_url\)[\s\S]*mutateWithPublicCacheInvalidation[\s\S]*expectedUpdatedAt:\s*current\.updated_at/,
  );
  assert.match(updateRoute, /replacingPublishedHero[\s\S]*await assertManagedPublicAssetReadable/);
  assert.match(
    reactivateRoute,
    /assertBeforeReactivate:[\s\S]*assertManagedPublicAssetReadable\(current\.hero_image_url\)[\s\S]*setActiveWithInvalidation:[\s\S]*expectedUpdatedAt:\s*current\.updated_at/,
  );
  assert.doesNotMatch(publishRoute, /setPublishedAt\([\s\S]*await assertManagedPublicAssetReadable/);
  assert.doesNotMatch(reactivateRoute, /setActive\([\s\S]*await assertManagedPublicAssetReadable/);
  const contents = read("lib/contents.ts");
  assert.match(
    contents,
    /const before = await fetchRowForUpdate[\s\S]*options\.assertBeforeActivation\?\.\(before\)[\s\S]*update contents set is_active/,
  );
  assert.match(
    contents,
    /export async function setPublishedAt[\s\S]*const before = await fetchRowForUpdate[\s\S]*options\.assertBeforePublish\?\.\(before\)[\s\S]*update contents set/,
  );
});
