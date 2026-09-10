import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function collectSourceFiles(relativeDir: string, accepts: (file: string) => boolean): string[] {
  return readdirSync(join(process.cwd(), relativeDir), { withFileTypes: true }).flatMap((entry) => {
    const relativePath = join(relativeDir, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(relativePath, accepts);
    return entry.isFile() && accepts(relativePath) ? [relativePath] : [];
  });
}

test("coverage compilation includes every admin library and API route", () => {
  const sources = [
    ...collectSourceFiles("lib", (file) => file.endsWith(".ts") && !file.endsWith(".d.ts")),
    ...collectSourceFiles("app/api", (file) => file.endsWith("/route.ts")),
  ];

  for (const source of sources) {
    const compiled = source.replace(/\.tsx?$/, ".js");
    assert.ok(existsSync(join(process.cwd(), ".test-dist", compiled)), `${source} is missing from coverage compilation`);
  }
});
