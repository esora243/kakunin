import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const readSource = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("saved-item mutation results are handled once in the shared context", () => {
  const context = readSource("components/SavedItemsContext.tsx");

  assert.match(
    context,
    /const toggleSaved = useCallback\(async[\s\S]*?try \{[\s\S]*?toast\.success[\s\S]*?catch \{[\s\S]*?activeUserId\.current === userId[\s\S]*?toast\.error/,
  );
  assert.match(
    context,
    /const removeSaved = useCallback\(async[\s\S]*?try \{[\s\S]*?toast\.success[\s\S]*?catch \{[\s\S]*?activeUserId\.current === userId[\s\S]*?toast\.error/,
  );
  assert.match(context, /保存状態の更新に失敗しました/);
  assert.match(context, /activeUserId\.current !== mutationUserId/);
});

test("every saved-item screen delegates mutations to the shared result handler", () => {
  const screens = [
    "app/jobs/JobsPageClient.tsx",
    "app/jobs/[slug]/JobDetailPageClient.tsx",
    "app/activities/ActivitiesPageClient.tsx",
    "app/activities/[slug]/ActivityDetailClient.tsx",
    "app/contents/ContentsPageClient.tsx",
    "app/contents/[slug]/ContentDetailClient.tsx",
    "app/profile/saved/ProfileSavedClient.tsx",
  ];

  for (const path of screens) {
    const source = readSource(path);
    assert.match(source, /useSavedItems\(\)/, path);
    assert.match(source, /(?:toggleSaved|removeSaved)\(/, path);
  }
});
