import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const readSource = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("global LINE action stays above bottom actions and banners", () => {
  const source = readSource("components/LineFollowFloating.tsx");
  // ブラウザ UI のセーフエリアぶんを含むオフセットはトークン (inset.browser-fab) に集約した。
  assert.match(source, /bottom-browser-fab/);
  assert.match(
    readSource("tailwind.config.ts"),
    /"browser-fab":\s*"calc\(6rem \+ var\(--hugmeid-browser-bottom, 0px\)\)"/,
  );
});

test("icon-only controls in the refreshed UI have accessible names", () => {
  // アイコンのみの操作は、直接の aria-label か、プリミティブへ渡すラベル prop で名前を持つ。
  const expectations: Array<[string, RegExp]> = [
    ["components/LoginModal.tsx", /closeLabel="ログイン画面を閉じる"/],
    ["components/JobFilterModal.tsx", /closeLabel="絞り込み検索を閉じる"/],
    ["app/jobs/JobsPageClient.tsx", /clearLabel="求人検索をクリア"/],
    ["app/jobs/JobsPageClient.tsx", /aria-label=\{activeFilterCount/],
    ["app/profile/edit/ProfileEditPageClient.tsx", /aria-label="マイページへ戻る"/],
    ["app/jobs/[slug]/JobDetailPageClient.tsx", /label="求人を共有"/],
    ["app/jobs/[slug]/JobDetailPageClient.tsx", /backLabel="前の画面へ戻る"/],
    ["app/activities/[slug]/ActivityDetailClient.tsx", /backLabel="課外活動一覧へ戻る"/],
    ["app/contents/[slug]/ContentDetailClient.tsx", /backLabel="コンテンツ一覧へ戻る"/],
    ["app/school/SchoolClassDetailView.tsx", /backLabel="前の画面へ戻る"/],
  ];

  for (const [path, pattern] of expectations) {
    assert.match(readSource(path), pattern, path);
  }

  // 戻る操作の読み上げ名は DetailScaffold が backLabel から付ける。
  const scaffold = readSource("components/ui/DetailScaffold.tsx");
  assert.match(scaffold, /aria-label=\{backLabel\}/);
  assert.match(scaffold, /<IconButton label=\{backLabel\}/);

  // マイページの編集導線は可視ラベルを持つ。
  assert.match(readSource("app/profile/ProfilePageClient.tsx"), /router\.push\("\/profile\/edit"\)/);
});

test("contextual detail back labels describe browser history rather than a fixed destination", () => {
  const jobDetail = readSource("app/jobs/[slug]/JobDetailPageClient.tsx");
  assert.match(jobDetail, /backLabel="前の画面へ戻る"/);
  assert.match(jobDetail, /router\.back\(\)/);
  assert.match(readSource("app/school/SchoolClassDetailView.tsx"), /backLabel="前の画面へ戻る"/);
});

test("registration leaves optional marketing and push preferences off", () => {
  const source = readSource("app/register/RegisterPageClient.tsx");
  assert.match(source, /consentMarketing:\s*false/);
  assert.match(source, /pushEnabled:\s*false/);
});

test("official LINE action is hidden when its HTTPS destination is not configured", () => {
  const source = readSource("components/LineFollowFloating.tsx");
  assert.match(source, /normalizeExternalHttpsUrl/);
  assert.match(source, /if \(closed \|\| !lineUrl\) return null/);
  assert.doesNotMatch(source, /https:\/\/line\.me\//);
});

test("detail error and not-found states keep Japanese recovery links", () => {
  const activityPage = readSource("app/activities/[slug]/page.tsx");
  const contentPage = readSource("app/contents/[slug]/page.tsx");
  const jobPage = readSource("app/jobs/[slug]/page.tsx");
  const activityNotFound = readSource("app/activities/[slug]/not-found.tsx");
  const contentNotFound = readSource("app/contents/[slug]/not-found.tsx");
  const jobNotFound = readSource("app/jobs/[slug]/not-found.tsx");

  assert.match(activityPage, /課外活動の取得に失敗しました/);
  assert.match(contentPage, /コンテンツの取得に失敗しました/);
  assert.match(jobPage, /求人の取得に失敗しました/);
  assert.match(activityNotFound, /課外活動一覧へ戻る/);
  assert.match(contentNotFound, /コンテンツ一覧へ戻る/);
  assert.match(jobNotFound, /求人一覧へ戻る/);
});

test("notification settings stay backend-only until delivery exists", () => {
  const profile = readSource("app/profile/ProfilePageClient.tsx");

  assert.doesNotMatch(profile, /\/profile\/notifications|通知設定/);
  assert.equal(existsSync(join(process.cwd(), "app/profile/notifications/page.tsx")), false);
  assert.equal(
    existsSync(join(process.cwd(), "app/profile/notifications/NotificationSettingsClient.tsx")),
    false,
  );
  assert.equal(existsSync(join(process.cwd(), "app/api/me/notification-settings/route.ts")), true);
  assert.equal(existsSync(join(process.cwd(), "lib/notification-settings.ts")), true);
});

test("contents list does not nest a second main landmark", () => {
  const source = readSource("app/contents/ContentsPageClient.tsx");
  assert.doesNotMatch(source, /<main[\s>]/);
  assert.match(source, /<Container as="section" aria-label="コンテンツ一覧"/);
});

test("FAQ is excluded from the public contents list", () => {
  const client = readSource("app/contents/ContentsPageClient.tsx");
  const contents = readSource("lib/contents.ts");

  assert.doesNotMatch(client, /faq:\s*"FAQ"/);
  assert.match(client, /type !== "faq"/);
  assert.match(contents, /row\.content_type !== "faq"/);
});
