import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

/**
 * UI 一貫性の回帰防止。
 *
 * 監査で見つかった発散 (max-w-lg 29箇所 / 直書き hex / top-[110px] / 開発者向け文言 /
 * example.com ダミー広告 / トークン別名 / 装飾色の無統制な流入) は、いずれも
 * 「CI を通ってしまう」ことが再発の原因だった。ここで機械的に落とす。
 */
const ROOTS = ["app", "components"];

type SourceFile = { path: string; text: string; code: string };

function collectSources(): SourceFile[] {
  const files: SourceFile[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!/\.tsx?$/.test(entry.name)) continue;
      if (statSync(path).size > 512_000) continue;
      const text = readFileSync(path, "utf8");
      files.push({ path: relative(process.cwd(), path), text, code: stripComments(text) });
    }
  };

  for (const root of ROOTS) walk(join(process.cwd(), root));
  return files;
}

/**
 * 説明コメントは検査対象から外す。
 * 「なぜこの書き方を禁止したか」をコード近くに残せるようにするため。
 */
function stripComments(text: string) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/([^:])\/\/[^\n]*/g, "$1");
}

const sources = collectSources();
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

function assertNoneMatch(pattern: RegExp, message: string, allow: (file: SourceFile) => boolean = () => false) {
  const offenders = sources
    .filter((file) => !allow(file))
    .filter((file) => pattern.test(file.code))
    .map((file) => file.path);
  assert.deepEqual(offenders, [], `${message}\n違反ファイル: ${offenders.join(", ")}`);
}

test("本番UIに開発者向け文言とダミー広告が残っていない", () => {
  assertNoneMatch(
    /dev seed|\.env またはデータ|データファイルで追加|次のバックエンドAPI|授業seed/,
    "データ欠損時の文言はユーザーの次の行動だけを書く (開発者への指示・実装予定を出さない)",
  );
  assertNoneMatch(/example\.com/, "example.com のダミーリンクを本番UIに置かない");
});

test("色は必ずトークン経由で指定する", () => {
  assertNoneMatch(/#[0-9A-Fa-f]{6}\b/, "生の hex は tailwind.config.ts / globals.css だけに置く");
  assertNoneMatch(
    /brand-light|brand-dark|brand-primary/,
    "brand の別名は値が重複し grep 検査が効かないため廃止済み。数値ランプを使う",
  );
  assertNoneMatch(
    /bg-(?:blue|purple|green|indigo|emerald|red)-(?:50|100|400|500)\b/,
    "装飾色は semantic (success/warning/danger/info) か分類用 accent ランプを使う",
  );
  assertNoneMatch(
    /text-(?:blue|purple|green|indigo|emerald)-(?:400|500|600|700|900)\b/,
    "文字色も semantic / accent トークンを使う",
  );
});

test("寸法は必ずトークン経由で指定する", () => {
  assertNoneMatch(
    /max-w-lg\b/,
    "ページ幅は Container (max-w-app / max-w-content) だけが決める",
  );
  assertNoneMatch(
    /\btop-\[/,
    "sticky の基準は top-sticky (--app-sticky-top) に統一する。top-[10px] / top-[110px] を作らない",
  );
  assertNoneMatch(/text-\[[0-9]/, "文字サイズは fontSize トークン (caption/meta/body/lead/h1..h3) を使う");
});

test("Container がページ幅の唯一の定義元で、desktop 幅も持つ", () => {
  const container = read("components/ui/Container.tsx");
  assert.match(container, /max-w-app/);
  assert.match(container, /md:max-w-content/);

  const tailwind = read("tailwind.config.ts");
  assert.match(tailwind, /app:\s*"32rem"/);
  // desktop 1440 でコンテンツ幅 >= 640px を満たす
  assert.match(tailwind, /content:\s*"48rem"/);

  // 幅トークンを直接参照してよいのはデザインシステム層 (components/ui) だけ。
  // 画面側は必ず Container 経由にする。
  for (const file of sources.filter((entry) => !entry.path.startsWith(join("components", "ui")))) {
    assert.doesNotMatch(file.code, /max-w-app\b/, `${file.path} が Container を経由せず幅を指定している`);
  }
});

test("AppShell の実寸と sticky 基準が CSS 変数に集約されている", () => {
  const globals = read("app/globals.css");
  assert.match(globals, /--app-nav-h:\s*64px/);
  assert.match(globals, /--app-sticky-top:\s*calc\(var\(--hugmeid-nav-top, 0px\) \+ var\(--app-nav-h\)\)/);

  // ヘッダーの実高 (境界線込みで h-16 = 64px) と --app-nav-h が一致していること
  const shell = read("components/AppShell.tsx");
  assert.match(shell, /<header className="sticky top-nav-top z-40 h-16 border-b/);
  // overflow-x-hidden はスクロールコンテナを作り sticky の基準を壊すので使わない
  assert.match(shell, /<main className="flex-1 overflow-x-clip">/);
  assert.doesNotMatch(stripComments(shell), /overflow-x-hidden/);
  assert.match(read("tailwind.config.ts"), /sticky:\s*"var\(--app-sticky-top\)"/);
});

test("メインタブは AppShell と重複して画面高を持たず、横幅を安定させる", () => {
  const globals = read("app/globals.css");
  assert.match(globals, /html\s*{[^}]*scrollbar-gutter:\s*stable;/);

  const shell = read("components/AppShell.tsx");
  assert.match(shell, /<div className="[^"]*min-h-screen[^"]*">/);

  for (const route of [
    "app/school/SchoolPageClient.tsx",
    "app/school/SchoolWorkspaceClient.tsx",
    "app/profile/ProfilePageClient.tsx",
  ]) {
    assert.doesNotMatch(
      stripComments(read(route)),
      /className="[^"]*\bmin-h-screen\b[^"]*"/,
      `${route} が AppShell と重複して viewport 高を持っている`,
    );
  }
});

test("ページタイトルは各ルートで固有", () => {
  const routes = [
    "app/school/page.tsx",
    "app/jobs/page.tsx",
    "app/activities/page.tsx",
    "app/contents/page.tsx",
    "app/profile/page.tsx",
    "app/profile/edit/page.tsx",
    "app/profile/saved/page.tsx",
    "app/contact/page.tsx",
    "app/faq/page.tsx",
    "app/register/page.tsx",
    "app/terms/page.tsx",
    "app/privacy/page.tsx",
  ];

  const titles = routes.map((route) => {
    const source = read(route);
    const match = source.match(/title:\s*"([^"]+)"/);
    assert.ok(match, `${route} に metadata.title が無い`);
    return match[1];
  });

  assert.equal(new Set(titles).size, titles.length, `ルート別 title が重複している: ${titles.join(", ")}`);

  // 詳細ルートは実データからタイトルを組み立てる
  for (const route of ["app/jobs/[slug]/page.tsx", "app/activities/[slug]/page.tsx", "app/contents/[slug]/page.tsx"]) {
    assert.match(read(route), /export async function generateMetadata/, `${route} に generateMetadata が無い`);
  }

  // layout がテンプレートを持ち、タブに画面名が出る
  assert.match(read("app/layout.tsx"), /template:\s*`%s \| \$\{metaAppName\}`/);
});

test("h1 はページ見出しの実装 1 箇所に集約されている", () => {
  // 一覧ルートは PageHeader 経由でのみ h1 を出す
  for (const route of [
    "app/jobs/JobsPageClient.tsx",
    "app/contents/ContentsPageClient.tsx",
    "app/activities/ActivitiesPageClient.tsx",
    "app/school/SchoolWorkspaceClient.tsx",
    "app/profile/ProfilePageClient.tsx",
  ]) {
    const source = read(route);
    assert.doesNotMatch(source, /<h1[\s>]/, `${route} が PageHeader を使わず h1 を直接書いている`);
    assert.match(source, /<PageHeader/, `${route} が PageHeader を使っていない`);
  }

  const pageHeader = read("components/ui/PageHeader.tsx");
  assert.equal(pageHeader.match(/<h1[\s>]/g)?.length, 1);
  assert.match(pageHeader, /text-h1 font-bold/);

  // 本文 Markdown は h2 から始める (記事タイトルの h1 と二重にしない)
  assert.doesNotMatch(read("components/MarkdownContent.tsx"), /<h1[\s>]/);
});

test("状態表示 (空 / エラー / ローディング) がプリミティブに集約されている", () => {
  // 空 div を返すローディングを作らない
  assertNoneMatch(
    /return <div className="[^"]*min-h-\[60vh\][^"]*" \/>/,
    "白画面フラッシュになる空 div のローディングを作らない",
  );

  // 生の error.message をユーザーに出さない受け皿があること
  const errorState = read("components/ui/ErrorState.tsx");
  assert.match(errorState, /process\.env\.NODE_ENV !== "production"/);
  assert.match(errorState, /detail/);

  assert.match(read("components/ui/LoadingState.tsx"), /role="status"/);
});

test("操作にフォーカスリングと 44px のタップ領域がある", () => {
  const button = read("components/ui/Button.tsx");
  assert.match(button, /focus-visible:ring-2/);
  assert.match(button, /min-h-tap/);

  // IconButton は読み上げ名を必須にする
  assert.match(button, /aria-label=\{label\}/);
  assert.match(button, /min-h-tap min-w-tap/);

  assert.match(read("tailwind.config.ts"), /tap:\s*"2\.75rem"/);
  assert.match(read("components/ui/FilterChip.tsx"), /min-h-tap/);
  assert.match(read("components/ui/SearchInput.tsx"), /min-h-tap/);
});

test("モーダルが dialog セマンティクスとフォーカス管理を持つ", () => {
  const modal = read("components/ui/Modal.tsx");

  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /event\.key === "Escape"/);
  // フォーカストラップと復帰
  assert.match(modal, /event\.key !== "Tab"/);
  assert.match(modal, /previouslyFocused\?\.focus\?\.\(\)/);
  // 背面スクロールロック
  assert.match(modal, /document\.body\.style\.overflow = "hidden"/);
  // 背景クリックで閉じる (dismissible のときのみ)
  assert.match(modal, /event\.target === event\.currentTarget/);

  // 2 モーダルすべてがプリミティブ経由
  for (const route of [
    "components/LoginModal.tsx",
    "components/JobFilterModal.tsx",
  ]) {
    assert.match(read(route), /from "@\/components\/ui\/Modal"/, `${route} が Modal プリミティブを使っていない`);
    assert.doesNotMatch(stripComments(read(route)), /role="dialog"/, `${route} が dialog を自前で組んでいる`);
  }

  const login = read("components/LoginModal.tsx");
  assert.match(login, /type="checkbox"/);
  assert.match(login, /disabled=\{submitting \|\| !agreed\}/);
});

test("検索・chip・選択肢が読み上げ可能な意味を持つ", () => {
  assert.match(read("components/ui/SearchInput.tsx"), /<label htmlFor=\{inputId\} className="sr-only">/);
  assert.match(read("components/ui/FilterChip.tsx"), /aria-pressed=\{selected\}/);

  const optionSelector = read("components/ui/OptionSelector.tsx");
  assert.match(optionSelector, /role=\{multiple \? "group" : "radiogroup"\}/);
  assert.match(optionSelector, /role=\{multiple \? "checkbox" : "radio"\}/);
  assert.match(optionSelector, /aria-checked=\{selected\}/);
  assert.match(optionSelector, /<fieldset/);
  assert.match(optionSelector, /<legend/);
});

test("押せない行に chevron と hover を出さない", () => {
  const listRow = read("components/ui/ListRow.tsx");
  // href / onClick が無い分岐には ChevronRight も hover も無い
  const staticBranch = listRow.slice(listRow.lastIndexOf("return ("));
  assert.doesNotMatch(staticBranch, /ChevronRight/);
  assert.doesNotMatch(staticBranch, /hover:/);

  // /profile の基本情報行は表示専用なので ListRow に onClick/href を渡さない
  const profile = read("app/profile/ProfilePageClient.tsx");
  assert.match(profile, /<ListRow icon=\{GraduationCap\} label="大学・卒業年度"/);
  assert.doesNotMatch(profile, /<ListRow icon=\{GraduationCap\}[^/]*href=/);
});

test("register と profile/edit が同じ選択肢実装を共有する", () => {
  for (const route of ["app/register/RegisterPageClient.tsx", "app/profile/edit/ProfileEditPageClient.tsx"]) {
    const source = read(route);
    assert.match(source, /from "@\/components\/ui\/OptionSelector"/, `${route} が OptionSelector を使っていない`);
    assert.match(source, /PROFILE_FIELDS/, `${route} が共通の項目定義を使っていない`);
    // 単一選択バグ (clubIds が 1 件しか選べない) の再発防止
    assert.doesNotMatch(source, /clubIds:\s*prev\.clubIds\.includes\([^)]*\)\s*\?\s*\[\]/, `${route} に clubs 単一選択バグが再発している`);
  }

  const shared = read("lib/profile-form.ts");
  assert.match(shared, /export function toggleClubId/);
  // 複数選択であること (既存を捨てずに追加/除去する)
  assert.match(shared, /clubIds\.includes\(id\)\s*\?\s*clubIds\.filter\([\s\S]*?\)\s*:\s*\[\.\.\.clubIds, id\]/);
});

test("マイページにプロフィール完成度を表示しない", () => {
  const profile = read("app/profile/ProfilePageClient.tsx");
  assert.doesNotMatch(profile, /プロフィール完成度|profileCompletion|role="progressbar"/);
});

test("スポンサー枠は実設定が無ければ描画しない", () => {
  const sponsors = read("lib/sponsors.ts");
  assert.match(sponsors, /normalizeExternalHttpsUrl/);
  assert.match(sponsors, /if \(!url \|\| !label\) return null/);

  const adBanner = read("components/AdBanner.tsx");
  assert.match(adBanner, /if \(!slot\) return null/);
  // 帯の内容も本文と同じ左右基準に揃える
  assert.match(adBanner, /<Container>/);
  // 広告表記
  assert.match(sponsors, /badge:\s*"PR"/);

  // 1 画面に複数のスポンサー枠を置かない
  for (const file of sources) {
    const occurrences = file.code.match(/<AdBanner\b/g)?.length ?? 0;
    assert.ok(occurrences <= 1, `${file.path} に AdBanner が ${occurrences} 箇所ある (1 画面 1 枠)`);
  }
});

test("求人の絞り込み選択肢が実データ由来", () => {
  const modal = read("components/JobFilterModal.tsx");
  // 静的なハードコード配列を持たない
  assert.doesNotMatch(modal, /const employmentTypes = \[/);
  assert.doesNotMatch(modal, /const prefectures = \[/);
  assert.match(modal, /facets: JobFacets/);
  assert.match(modal, /if \(items\.length === 0\) return null/);

  const list = read("app/jobs/JobsPageClient.tsx");
  assert.match(list, /employmentTypes: uniqueValues\(jobs\.map/);
  assert.match(list, /prefectures: uniqueValues\(jobs\.map/);
});

test("未ログイン時に想定内の 401 をコンソールへ出さない", () => {
  const hint = read("lib/auth/session-hint.ts");
  assert.match(hint, /export function hasSessionHintCookie/);

  const authContext = read("components/AuthContext.tsx");
  assert.match(authContext, /if \(!hasSessionHintCookie\(\)\) return null;/);

  // ヒントは非機密。認証判断はサーバ側のまま変えない。
  assert.match(read("lib/auth/session.ts"), /httpOnly: true/);
  assert.match(read("proxy.ts"), /syncSessionHintCookie/);
  // /api/me の契約 (401) は維持する
  assert.match(read("app/api/me/route.ts"), /unauthorizedResult\(\)/);
});

test("詳細画面が同じ骨格を共有する", () => {
  for (const route of [
    "app/jobs/[slug]/JobDetailPageClient.tsx",
    "app/activities/[slug]/ActivityDetailClient.tsx",
    "app/contents/[slug]/ContentDetailClient.tsx",
    "app/school/SchoolClassDetailView.tsx",
  ]) {
    assert.match(read(route), /from "@\/components\/ui\/DetailScaffold"/, `${route} が DetailScaffold を使っていない`);
  }

  // jobs だけ自作の 404 を持たない
  const jobDetail = read("app/jobs/[slug]/JobDetailPageClient.tsx");
  assert.doesNotMatch(jobDetail, /求人が見つかりません/);
  assert.match(read("app/jobs/[slug]/not-found.tsx"), /DetailUnavailable/);
  assert.match(read("app/jobs/[slug]/page.tsx"), /notFound\(\)/);

  // 応募 CTA に LINE 緑を使わない (LINE 連携と誤認させない)
  assert.doesNotMatch(jobDetail, /variant="line"/);
});
