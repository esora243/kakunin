import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function collectTestFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return collectTestFiles(path);
    return entry.isFile() && entry.name.endsWith(".test.js") ? [path] : [];
  });
}

if (!existsSync(".test-dist/tests")) {
  console.error("Compiled test directory not found: .test-dist/tests");
  process.exit(1);
}

const testFiles = collectTestFiles(".test-dist/tests").sort();

if (testFiles.length === 0) {
  console.error("No compiled test files found under .test-dist/tests");
  process.exit(1);
}

const args = ["--test", ...testFiles];
const result = spawnSync(process.execPath, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ` : ""}--require ./tests/server-only-shim.cjs`,
  },
});

process.exit(result.status ?? 1);
