import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();
const rootPageSource = readFileSync(join(projectRoot, "app/page.tsx"), "utf8");
const bridgeSource = readFileSync(join(projectRoot, "components/LiffRootBridge.tsx"), "utf8");
const liffClientSource = readFileSync(join(projectRoot, "lib/liff/client.ts"), "utf8");

test("root renders a client LIFF bridge instead of redirecting before SDK initialization", () => {
  assert.match(rootPageSource, /<LiffRootBridge \/>/);
  assert.doesNotMatch(rootPageSource, /next\/navigation|redirect\(/);
});

test("root bridge changes URL only after LIFF initialization resolves", () => {
  const initIndex = bridgeSource.indexOf("await initLiff()");
  const redirectIndex = bridgeSource.indexOf('window.location.replace("/school")');

  assert.ok(initIndex >= 0);
  assert.ok(redirectIndex > initIndex);
  assert.match(bridgeSource, /catch\s*\{/);
  assert.match(bridgeSource, /fixed inset-0 z-\[300\]/);
  assert.match(bridgeSource, /<noscript>/);
  assert.match(bridgeSource, /event\.key === "Tab"/);
});

test("external LINE login carries a transient initialization signal to the secondary URL", () => {
  const markIndex = liffClientSource.lastIndexOf("markPendingLiffLogin()");
  const loginIndex = liffClientSource.lastIndexOf("liff.login(");

  assert.ok(markIndex >= 0);
  assert.ok(loginIndex > markIndex);
  assert.match(liffClientSource, /if \(hasPendingLiffLogin\(\)\) return true/);
  assert.match(liffClientSource, /clearPendingLiffLogin\(\)/);
});
