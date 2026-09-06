import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ADMIN_ROOT = join(process.cwd());

function readAdminFile(relativePath: string): string {
  return readFileSync(join(ADMIN_ROOT, relativePath), "utf8");
}

function walkAdminFiles(relativeDir: string): string[] {
  const absoluteDir = join(ADMIN_ROOT, relativeDir);
  return readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") return [];
      return walkAdminFiles(relativePath);
    }
    if (!entry.isFile()) return [];
    if (!/\.(ts|tsx|js|mjs|cjs|json)$/.test(entry.name)) return [];
    return [relativePath];
  });
}

function walkRouteFiles(relativeDir: string): string[] {
  const absoluteDir = join(ADMIN_ROOT, relativeDir);
  return readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = join(relativeDir, entry.name);
    if (entry.isDirectory()) return walkRouteFiles(relativePath);
    if (!entry.isFile()) return [];
    return entry.name === "route.ts" ? [relativePath] : [];
  });
}

function walkPageFiles(relativeDir: string): string[] {
  const absoluteDir = join(ADMIN_ROOT, relativeDir);
  return readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = join(relativeDir, entry.name);
    if (entry.isDirectory()) return walkPageFiles(relativePath);
    if (!entry.isFile()) return [];
    return entry.name === "page.tsx" ? [relativePath] : [];
  });
}

test("all admin API handlers export adminApiRoute wrappers", () => {
  const routeFiles = walkRouteFiles("app/api");

  for (const file of routeFiles) {
    const source = readAdminFile(file);
    const handlerLines = source
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^export const (GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS)\s*=/.test(line));

    assert.ok(handlerLines.length > 0, `${file} exports no HTTP handlers`);
    assert.ok(
      handlerLines.every((line) => /adminApiRoute\s*\(/.test(line)),
      `${file} exports a handler that does not use adminApiRoute`,
    );
  }
});

test("the root admin layout keeps the page guard in place for all admin pages", () => {
  const source = readAdminFile("app/layout.tsx");
  assert.match(source, /getAdminIdentityForPage\s*\(/, "app/layout.tsx must guard the admin shell");
  assert.match(source, /AdminAccessDenied/, "app/layout.tsx must preserve the deny state");
});

test("admin pages stop unauthenticated server rendering before data loads", () => {
  const pageFiles = walkPageFiles("app");
  const dataLoadPattern = /\bawait\s+(?:Promise\.all\(|load[A-Z]\w*\(|list[A-Z]\w*\(|get[A-Z]\w*\(|dbQuery\(|checkDatabaseReachable\()/g;

  for (const file of pageFiles) {
    const source = readAdminFile(file);
    const identityIndex = source.indexOf("const identity = await getAdminIdentityForPage()");
    if (identityIndex === -1) continue;

    const guardIndex = source.indexOf("if (!identity", identityIndex);
    assert.notEqual(guardIndex, -1, `${file} must return before data loading when no admin identity exists`);

    const afterIdentity = source.slice(source.indexOf("\n", identityIndex) + 1);
    const dataMatch = dataLoadPattern.exec(afterIdentity);
    dataLoadPattern.lastIndex = 0;
    if (dataMatch) {
      const dataIndex = source.indexOf("\n", identityIndex) + 1 + dataMatch.index;
      assert.ok(guardIndex < dataIndex, `${file} loads data before the unauthenticated page guard`);
    }
  }
});

test("admin access audit insert casts reused id parameters for production PostgreSQL", () => {
  const source = readAdminFile("lib/audit.ts");
  assert.match(source, /\$1::uuid/, "admin.access actor_admin_id must cast the reused id as uuid");
  assert.match(source, /\$1::text/, "admin.access resource_id must cast the reused id as text");
});

test("admin auth code does not contain legacy production compatibility paths", () => {
  const sources = ["app", "components", "lib"]
    .flatMap((dir) => walkAdminFiles(dir).filter((path) => !path.includes("/tests/")))

  const forbiddenPatterns: Array<[RegExp, string]> = [
    [/ADMIN_IAP_AUDIENCE/, "ADMIN_IAP_AUDIENCE"],
    [/X-Goog-IAP-JWT-Assertion/i, "trusted IAP header auth"],
    [/\bX-Goog-Authenticated-User-(Email|Id)\b/i, "direct identity headers"],
    [/\bquery[- ]token\b/i, "query-token auth"],
    [/\bshared[- ]password\b/i, "shared-password auth"],
    [/\bpassword login\b/i, "password login"],
    [/\bpublic app session\b/i, "public app session auth"],
    [/\blegacy admin login routes?\b/i, "parallel legacy admin login routes"],
    [/\bparallel login routes?\b/i, "parallel login routes"],
    [/\bFirebase\b/i, "Firebase"],
    [/\bAuth0\b/i, "Auth0"],
    [/\bCloudflare Access\b/i, "Cloudflare Access"],
  ];

  for (const sourcePath of sources) {
    const source = readAdminFile(sourcePath);
    for (const [pattern, label] of forbiddenPatterns) {
      assert.equal(pattern.test(source), false, `${sourcePath} still mentions ${label}`);
      pattern.lastIndex = 0;
    }
  }
});
