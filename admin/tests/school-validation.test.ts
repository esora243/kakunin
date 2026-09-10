import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertOrderedDateRange } from "../lib/date-range";

const schoolControlsSource = readFileSync(
  join(process.cwd(), "components/school/SchoolEditControls.tsx"),
  "utf8",
);

test("pickSyllabusPagePatch accepts ordered date ranges", () => {
  assert.doesNotThrow(() => assertOrderedDateRange("2026-04-01", "2026-09-30", "Effective start date", "Effective end date"));
});

test("pickSyllabusPagePatch rejects reversed date ranges", () => {
  assert.throws(
    () => assertOrderedDateRange("2026-10-01", "2026-09-30", "Effective start date", "Effective end date"),
    (error) => error instanceof Error && error.message.includes("must be on or before"),
  );
});

test("school edits surface cache invalidation and network failures", () => {
  assert.match(schoolControlsSource, /result\.cacheWarning/);
  assert.match(schoolControlsSource, /公開サイトへの反映に失敗しました/);
  assert.ok((schoolControlsSource.match(/catch \(caught\)/g)?.length ?? 0) >= 2);
});
