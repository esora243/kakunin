import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const envExample = () => readFileSync(join(process.cwd(), ".env.example"), "utf8");
const deploymentChecklist = () =>
  readFileSync(join(process.cwd(), "docs/production-deployment-checklist.md"), "utf8");
const ciWorkflow = () => readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
const adminRunbook = () => readFileSync(join(process.cwd(), "docs/admin-runbooks.md"), "utf8");
const adminEnvExample = () => readFileSync(join(process.cwd(), "admin/.env.example"), "utf8");
const adminReadme = () => readFileSync(join(process.cwd(), "admin/README.md"), "utf8");
const nextConfig = () => readFileSync(join(process.cwd(), "next.config.mjs"), "utf8");
const proxy = () => readFileSync(join(process.cwd(), "proxy.ts"), "utf8");
const gcloudIgnore = () => readFileSync(join(process.cwd(), ".gcloudignore"), "utf8");
const globalsCss = () => readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
const appShell = () => readFileSync(join(process.cwd(), "components/AppShell.tsx"), "utf8");
const appToaster = () => readFileSync(join(process.cwd(), "components/AppToaster.tsx"), "utf8");
const authContext = () => readFileSync(join(process.cwd(), "components/AuthContext.tsx"), "utf8");
const loginModal = () => readFileSync(join(process.cwd(), "components/LoginModal.tsx"), "utf8");
const loginModalHost = () => readFileSync(join(process.cwd(), "components/LoginModalHost.tsx"), "utf8");
const schoolWorkspace = () => readFileSync(join(process.cwd(), "app/school/SchoolWorkspaceClient.tsx"), "utf8");
const schoolTimetableTab = () => readFileSync(join(process.cwd(), "app/school/SchoolTimetableTab.tsx"), "utf8");
const connectPage = () => readFileSync(join(process.cwd(), "app/connect/page.tsx"), "utf8");
const contactPage = () => readFileSync(join(process.cwd(), "app/contact/page.tsx"), "utf8");
const contactPanel = () => readFileSync(join(process.cwd(), "app/contact/ContactPanel.tsx"), "utf8");
const faqPage = () => readFileSync(join(process.cwd(), "app/faq/page.tsx"), "utf8");
const jobDetail = () => readFileSync(join(process.cwd(), "app/jobs/[slug]/JobDetailPageClient.tsx"), "utf8");
const profilePage = () => readFileSync(join(process.cwd(), "app/profile/ProfilePageClient.tsx"), "utf8");
const registerClient = () => readFileSync(join(process.cwd(), "app/register/RegisterPageClient.tsx"), "utf8");
const profileEditClient = () => readFileSync(join(process.cwd(), "app/profile/edit/ProfileEditPageClient.tsx"), "utf8");
const profileOptionsRoute = () => readFileSync(join(process.cwd(), "app/api/profile/options/route.ts"), "utf8");
const jobsRoute = () => readFileSync(join(process.cwd(), "app/api/jobs/route.ts"), "utf8");
const jobDetailRoute = () => readFileSync(join(process.cwd(), "app/api/jobs/[slug]/route.ts"), "utf8");
const timetableRoute = () => readFileSync(join(process.cwd(), "app/api/timetable/route.ts"), "utf8");
const healthRoute = () => readFileSync(join(process.cwd(), "app/api/health/route.ts"), "utf8");
const detailScaffold = () => readFileSync(join(process.cwd(), "components/ui/DetailScaffold.tsx"), "utf8");
const tailwindConfig = () => readFileSync(join(process.cwd(), "tailwind.config.ts"), "utf8");

function readProjectTextFiles(root: string, ignoredDirectories = new Set([".git", ".next", ".test-dist", "node_modules", "tmp"])) {
  const files: Array<{ path: string; text: string }> = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...readProjectTextFiles(path, ignoredDirectories));
      continue;
    }
    if (!entry.isFile()) continue;
    if (statSync(path).size > 512_000) continue;
    if (!/\.(?:css|js|json|md|mjs|sql|ts|tsx|txt|yml|yaml)$/.test(entry.name) && entry.name !== ".env.example") continue;
    files.push({ path, text: readFileSync(path, "utf8") });
  }

  return files;
}

test(".env.example covers production runtime environment variables without secrets", () => {
  const env = envExample();

  for (const variable of [
    "NEXT_PUBLIC_APP_NAME",
    "NEXT_PUBLIC_APP_DESCRIPTION",
    "NEXT_PUBLIC_SITE_URL",
    "IMAGE_ALLOWED_REMOTE_HOSTS",
    "HUGMEID_DEPLOY_ENV",
    "HUGMEID_DATABASE_ENV",
    "CLOUD_SQL_CONNECTION_NAME",
    "PGHOST",
    "PGPORT",
    "PGDATABASE",
    "PGUSER",
    "PGPASSWORD",
    "HUGMEID_TRUSTED_PROXY_HOPS",
    "NEXT_PUBLIC_LIFF_ID",
    "NEXT_PUBLIC_LINE_LOGIN_URL",
    "LINE_CHANNEL_ID",
    "LINE_CHANNEL_SECRET",
    "LINE_CHANNEL_ACCESS_TOKEN",
    "SESSION_SECRET",
    "NEXT_PUBLIC_SYLLABUS_URL",
    "NEXT_PUBLIC_CONTACT_EMAIL",
  ]) {
    assert.match(env, new RegExp(`^${variable}=`, "m"));
  }

  assert.match(env, /^PGPASSWORD=$/m);
  assert.doesNotMatch(env, /line_channel_secret_[A-Za-z0-9]/i);
  assert.doesNotMatch(env, /SESSION_SECRET=.{20,}/);
});

test("production artifacts do not keep a mock authentication path", () => {
  const forbidden = [
    "HUGMEID_DEV_MOCK_AUTH",
    "__HUGMEID_DEV_MOCK_ID_TOKEN__",
    "dev-line-uid",
    "allowDevMock",
    "canUseDevMockAuth",
  ];

  for (const file of readProjectTextFiles(process.cwd())) {
    for (const marker of forbidden) {
      if (file.path.endsWith("production-readiness-artifacts.test.ts")) continue;
      assert.doesNotMatch(file.text, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${marker} remained in ${file.path}`);
    }
  }
});

test("Cloud Run source deploy excludes local secrets and build artifacts", () => {
  const ignore = gcloudIgnore();

  for (const required of [".env", ".env.*", "node_modules/", ".next/", ".test-dist/", "tmp/"]) {
    assert.match(ignore, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(ignore, /!\.env\.example/);
});

test("Next.js config applies browser security headers and constrained images", () => {
  const config = nextConfig();
  const cspProxy = proxy();

  for (const required of [
    "Referrer-Policy",
    "X-Content-Type-Options",
    "Permissions-Policy",
    "Cross-Origin-Opener-Policy",
    "Cache-Control",
    "no-store",
    "/api/me/:path*",
    "/api/auth/:path*",
    "IMAGE_ALLOWED_REMOTE_HOSTS",
    "remotePatterns: imageRemotePatterns",
  ]) {
    assert.match(config, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const required of ["object-src 'none'", "frame-ancestors", "style-src", "font-src", "connect-src"]) {
    assert.match(cspProxy, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const required of ["static.line-scdn.net", "liffsdk.line-scdn.net", "liff-subwindow.line.me", "uts-front.line-apps.com"]) {
    assert.match(cspProxy, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(config, /hostname:\s*"\\*\\*"/);
  assert.match(cspProxy, /Content-Security-Policy/);
  assert.match(cspProxy, /nonce-/);
  assert.match(cspProxy, /strict-dynamic/);
  assert.doesNotMatch(cspProxy.match(/script-src[^\n]+/)?.[0] ?? "", /unsafe-inline/);
});

test("public API cache headers are success-only", () => {
  for (const source of [jobsRoute(), jobDetailRoute(), timetableRoute()]) {
    assert.match(source, /publicCachedJsonRoute/);
    assert.match(source, /public, max-age=30, stale-while-revalidate=300/);
  }

  assert.match(jobsRoute(), /invalid_query[\s\S]*"Cache-Control": "no-store"/);
  assert.match(profileOptionsRoute(), /public, max-age=300, stale-while-revalidate=3600/);
  assert.match(profileOptionsRoute(), /"Cache-Control": "no-store"/);
  assert.doesNotMatch(nextConfig(), /source: "\/api\/profile\/options"[\s\S]*public, max-age=300/);
});

test("health endpoint keeps operational details private and uncached", () => {
  const source = healthRoute();

  assert.match(source, /"Cache-Control": "no-store"/);
  assert.match(source, /sha \? \{ "X-Hugmeid-Release-SHA": sha \} : \{\}/);
  assert.match(source, /return healthResponse\(false, 503\)/);
  assert.match(source, /assertPublicRuntimeConfig\(\)/);
  assert.match(source, /NextResponse\.json\(\{ ok \}/);
  assert.doesNotMatch(source, /toPublicRuntimeEnvironment/);
  assert.doesNotMatch(source, /db:\s*"/);
  assert.doesNotMatch(source, /environment:/);
});

test("logout and share UI preserve partial and failed results", () => {
  const auth = authContext();
  const profile = readFileSync(join(process.cwd(), "app/profile/ProfilePageClient.tsx"), "utf8");
  const jobDetail = readFileSync(join(process.cwd(), "app/jobs/[slug]/JobDetailPageClient.tsx"), "utf8");
  assert.match(auth, /status: "failed"[\s\S]*liffSession: "not_attempted"/);
  assert.match(auth, /status: "partial"[\s\S]*liffSession: "failed"/);
  assert.match(profile, /result\.status === "failed"[\s\S]*もう一度お試しください/);
  assert.match(profile, /result\.status === "partial"[\s\S]*LINE側のログアウトに失敗/);
  assert.match(jobDetail, /error\.name === "AbortError"/);
  assert.match(jobDetail, /URLを手動でコピー/);
});

test("toast host is mounted at the app shell for public routes", () => {
  assert.match(appShell(), /import \{ AppToaster \} from "@\/components\/AppToaster"/);
  assert.match(appShell(), /<AppToaster \/>/);
  assert.match(appToaster(), /import \{ Toaster \} from "sonner"/);
  assert.match(appToaster(), /<Toaster position="top-center" \/>/);
  assert.doesNotMatch(loginModalHost(), /\bToaster\b/);
});

test("LIFF login failures remain visible instead of looking like a dead button", () => {
  assert.match(authContext(), /setError\(message\)/);
  assert.match(authContext(), /LINEログイン画面を開いています/);
  assert.match(loginModal(), /AuthProvider owns the user-facing error message/);
  assert.match(loginModalHost(), /result === "authenticated"/);
  assert.doesNotMatch(loginModalHost(), /await login\(\);\s*toast\.success/);
});

test("visible controls do not keep no-op placeholder buttons", () => {
  assert.doesNotMatch(schoolWorkspace(), /<Menu size=\{16\}/);
  assert.doesNotMatch(schoolWorkspace(), /<Clock size=\{16\}/);
  assert.doesNotMatch(schoolTimetableTab(), /<button className="p-1"><Chevron/);

  for (const source of [jobDetail()]) {
    assert.match(source, /const handleShare = async \(\) =>/);
    assert.match(source, /navigator\.clipboard\.writeText\(window\.location\.href\)/);
  }

  assert.match(profilePage(), /<ListRow icon=\{HelpCircle\} label="よくある質問" href="\/faq" \/>/);
  assert.match(profilePage(), /<ListRow icon=\{Mail\} label="お問い合わせ" href="\/contact" \/>/);
  assert.match(profilePage(), /<ListRow icon=\{FileText\} label="利用規約" href="\/terms" \/>/);
  assert.match(profilePage(), /<ListRow icon=\{ShieldCheck\} label="プライバシーポリシー" href="\/privacy" \/>/);
  assert.equal(profilePage().match(/<ProfilePublicLinks \/>/g)?.length, 2);
  assert.doesNotMatch(profilePage(), /ログインせずに利用できます/);
  assert.doesNotMatch(profilePage(), /現在準備中です/);
});

test("detail CTAs use zero-based browser chrome offsets", () => {
  assert.match(globalsCss(), /--hugmeid-nav-top:\s*0px/);
  assert.match(globalsCss(), /--hugmeid-browser-bottom:\s*0px/);
  assert.equal(existsSync(join(process.cwd(), "components/AppBrowserChrome.tsx")), false);
  assert.doesNotMatch(appShell(), /AppBrowserChrome/);

  // 固定 CTA バーのオフセットは DetailScaffold が唯一の実装で、値はトークン経由。
  const scaffold = detailScaffold();
  assert.match(scaffold, /bottom-browser\b/);
  assert.match(scaffold, /pb-bottom-bar\b/);
  assert.match(tailwindConfig(), /browser:\s*"var\(--hugmeid-browser-bottom, 0px\)"/);
  assert.match(tailwindConfig(), /"bottom-bar":\s*"calc\(7rem \+ var\(--hugmeid-browser-bottom, 0px\)\)"/);

  for (const source of [jobDetail()]) {
    assert.match(source, /<DetailScaffold/);
    assert.match(source, /bottomBar=\{/);
    assert.doesNotMatch(source, /hugmeid-browser-bottom,64px/);
  }
});

test("support routes separate FAQ from contact and preserve the legacy redirect", () => {
  const clientSources = contactPanel();

  assert.match(contactPage(), /<ContactPanel contactEmail=\{siteConfig\.contactEmail\} \/>/);
  assert.match(contactPanel(), /mailto:\$\{contactEmail\}/);
  assert.doesNotMatch(clientSources, /@\/lib\/site|siteConfig/);
  assert.match(faqPage(), /title="よくある質問"/);
  assert.match(faqPage(), /listCachedFaqs/);
  assert.match(faqPage(), /aria-label="よくある質問一覧"/);
  assert.match(faqPage(), /href="\/contact"/);
  assert.match(connectPage(), /permanentRedirect\("\/contact"\)/);
});

test("public navigation matches the final five-destination IA and legacy routes are absent", () => {
  const shell = appShell();
  for (const route of ["/school", "/jobs", "/activities", "/contents", "/profile"]) assert.match(shell, new RegExp(route));
  for (const route of ["/articles", "/connect", "/sponsors", "/campaign", "/saved"]) assert.doesNotMatch(shell, new RegExp(route));
  for (const route of ["app/campaign/page.tsx", "app/campaign/[id]/page.tsx", "app/sponsors/page.tsx", "app/saved/page.tsx", "app/school/articles/[id]/page.tsx", "app/activities/groups/[id]/page.tsx"]) assert.equal(existsSync(join(process.cwd(), route)), false);
  assert.equal(existsSync(join(process.cwd(), "lib/data.ts")), false);
});

test("profile option failures stay visible and local development has a safe fallback", () => {
  assert.match(profileOptionsRoute(), /createDefaultProfileOptions/);
  assert.match(profileOptionsRoute(), /database_config_missing/);
  assert.match(profileOptionsRoute(), /error\.deployEnv === "local"/);

  for (const source of [registerClient(), profileEditClient()]) {
    assert.match(source, /optionsLoading/);
    assert.match(source, /optionsError/);
    assert.match(source, /プロフィール選択肢を読み込めませんでした/);
    assert.match(source, /再読み込み/);
  }
});

test("production deployment checklist documents release gates and boundary requirements", () => {
  const checklist = deploymentChecklist();

  for (const required of [
    "npm run test",
    "npm run typecheck",
    "npm run lint",
    "npm run build",
    "npm audit --omit=dev --audit-level=moderate",
    "Do not deploy while any of these are failing.",
    "A failing audit blocks production deployment",
    "any failing release-gate command must be fixed by a focused remediation PR",
    "scripts/cloudsql-migrate.mjs",
    "scripts/cloudsql-verify.mjs",
    "LIFF ID token -> /api/auth/line/session -> Hugmeid session cookie",
    "Do not expose raw `line_uid`",
    "database passwords out of browser code",
    "app_environment",
    "Missing `SESSION_SECRET` prevents session creation",
    "develop -> staging",
    "main -> production",
    "separate LINE Login channels/LIFF apps",
    "hugmeid-web-staging",
    "hugmeid-web-production",
    "internal-and-cloud-load-balancing",
    "default `run.app` URL disabled",
    "routes 10% to the candidate and 90% to the previous revision",
    "candidate release SHA to be observed successfully at least three times",
    "only when the active allocation is an exact state owned by this rollout",
  ]) {
    assert.match(checklist, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(checklist, /LINE\/LIFF credentials may remain shared/);
  assert.doesNotMatch(checklist, /creates a tagged candidate|candidate's direct tagged URL|production service to use `ingress=all`/);
});

test("main pushes use a smoke-gated production rollout with rollback", () => {
  const workflow = ciWorkflow();

  assert.match(workflow, /deploy-production:/);
  assert.match(workflow, /needs:\s*\n\s*- public-verify\s*\n\s*- admin-verify/);
  assert.match(workflow, /github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /google-github-actions\/auth@[0-9a-f]{40}/);
  assert.match(workflow, /workload_identity_provider: \$\{\{ vars\.GCP_WORKLOAD_IDENTITY_PROVIDER \}\}/);
  assert.match(workflow, /gcloud run deploy/);
  assert.match(workflow, /--source \./);
  assert.match(workflow, /HUGMEID_RELEASE_SHA=\$GITHUB_SHA/);
  assert.match(workflow, /previous_revision=/);
  assert.match(workflow, /\.status\.traffic\[\]\?/);
  assert.match(workflow, /run\.googleapis\.com\/ingress/);
  assert.match(workflow, /run\.googleapis\.com\/default-url-disabled/);
  assert.match(workflow, /internal-and-cloud-load-balancing/);
  assert.match(workflow, /default run\.app URL disabled/);
  assert.doesNotMatch(workflow, /direct_service_url/);
  assert.match(workflow, /candidate_suffix="\$\{GITHUB_SHA:0:7\}-\$\{GITHUB_RUN_ID\}-\$\{GITHUB_RUN_ATTEMPT\}"/);
  assert.match(workflow, /--revision-suffix "\$candidate_suffix"/);
  assert.match(workflow, /--no-traffic/);
  assert.match(workflow, /gcloud run revisions describe "\$candidate_revision"/);
  assert.match(workflow, /ready_status/);
  assert.match(workflow, /gcloud run services update-traffic/);
  assert.match(workflow, /--to-revisions="\$CANDIDATE_REVISION=10,\$PREVIOUS_REVISION=90"/);
  assert.match(workflow, /--to-revisions="\$CANDIDATE_REVISION=100"/);
  assert.match(workflow, /Production traffic changed after capture; refusing to start the canary/);
  assert.match(workflow, /Canary traffic did not settle at candidate=10%, previous=90%/);
  assert.match(workflow, /for attempt in \$\(seq 1 100\)/);
  assert.match(workflow, /candidate_observations.*-ge 3/);
  assert.match(workflow, /Candidate health check returned HTTP \$status/);
  assert.match(workflow, /X-Hugmeid-Release-SHA/);
  assert.match(workflow, /--update-build-env-vars/);
  assert.match(workflow, /NEXT_PUBLIC_SITE_URL: https:\/\/public-ci\.example/);
  assert.match(workflow, /NEXT_PUBLIC_CONTACT_EMAIL: contact@public-ci\.example/);
  assert.match(workflow, /HUGMEID_DEPLOY_ENV=production/);
  assert.match(workflow, /IMAGE_ALLOWED_REMOTE_HOSTS=\$\{\{ vars\.IMAGE_ALLOWED_REMOTE_HOSTS \}\}/);
  assert.match(workflow, /\^\|\^HUGMEID_DEPLOY_ENV/);
  assert.match(workflow, /Production traffic changed during the canary/);
  assert.match(workflow, /describe_service\(\)/);
  assert.match(workflow, /for attempt in \$\(seq 1 5\)/);
  assert.match(workflow, /traffic_is_previous_only\(\)/);
  assert.match(workflow, /traffic_is_canary\(\)/);
  assert.match(workflow, /traffic_is_candidate_only\(\)/);
  assert.match(workflow, /fail_with_rollback/);
  assert.match(workflow, /fail_without_rollback/);
  assert.match(workflow, /rollback_to_previous/);
  assert.match(workflow, /previous-or-canary/);
  assert.match(workflow, /canary-or-promoted/);
  assert.match(workflow, /--to-revisions="\$PREVIOUS_REVISION=100"/);
  assert.match(workflow, /Rollback completed and the production health check passed/);
  assert.match(workflow, /Rollback did not restore verified production service/);
  assert.match(workflow, /Rollback skipped because this workflow no longer owns the active traffic allocation/);
  assert.match(workflow, /traffic was not changed because this workflow no longer owns the active allocation/);
  assert.match(workflow, /\$PRODUCTION_URL\/api\/health/);
  assert.doesNotMatch(workflow, /candidate_tag|CANDIDATE_URL|--remove-tags/);
  assert.doesNotMatch(workflow, /credentials_json|service_account_key/);

  const preCanaryGuard = workflow.indexOf('service_before_canary=');
  const canaryCutover = workflow.indexOf('--to-revisions="$CANDIDATE_REVISION=10,$PREVIOUS_REVISION=90"');
  const prePromotionGuard = workflow.indexOf('service_before_promotion=');
  const candidateCutover = workflow.indexOf('--to-revisions="$CANDIDATE_REVISION=100"');
  const rollbackFunction = workflow.indexOf('rollback_to_previous()');
  const rollbackCutover = workflow.indexOf('--to-revisions="$PREVIOUS_REVISION=100"');
  assert.ok(preCanaryGuard >= 0 && preCanaryGuard < canaryCutover);
  assert.ok(canaryCutover >= 0 && canaryCutover < prePromotionGuard);
  assert.ok(prePromotionGuard >= 0 && prePromotionGuard < candidateCutover);
  assert.ok(rollbackFunction >= 0 && rollbackFunction < rollbackCutover);
  assert.ok(rollbackCutover >= 0 && rollbackCutover < canaryCutover);
});

test("CI automatically enforces coverage gates and cancels stale non-production runs", () => {
  const workflow = ciWorkflow();
  const publicPackage = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    engines: { node: string };
    scripts: Record<string, string>;
  };
  const adminPackage = JSON.parse(readFileSync(join(process.cwd(), "admin/package.json"), "utf8")) as {
    engines: { node: string };
    scripts: Record<string, string>;
  };
  const publicCoverage = JSON.parse(readFileSync(join(process.cwd(), ".c8rc.json"), "utf8")) as Record<string, unknown>;
  const adminCoverage = JSON.parse(readFileSync(join(process.cwd(), "admin/.c8rc.json"), "utf8")) as Record<string, unknown>;

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}/);
  assert.match(workflow, /cancel-in-progress: \$\{\{ github\.ref != 'refs\/heads\/main' \}\}/);
  assert.equal(workflow.match(/run: npm run test:coverage/g)?.length, 2);
  assert.match(workflow, /node --test scripts\/backfill-asset-variants\.test\.mjs/);

  assert.equal(publicPackage.engines.node, ">=22.12.0");
  assert.equal(adminPackage.engines.node, ">=22.12.0");
  assert.match(publicPackage.scripts["test:coverage"] ?? "", /c8 node scripts\/run-node-tests\.mjs/);
  assert.match(adminPackage.scripts["test:coverage"] ?? "", /c8 node scripts\/run-node-tests\.mjs/);

  assert.deepEqual(publicCoverage.include, [
    ".test-dist/lib/**/*.js",
    ".test-dist/app/api/**/route.js",
    ".test-dist/app/school/school-workspace-shared.js",
  ]);
  assert.deepEqual(adminCoverage.include, [
    ".test-dist/lib/**/*.js",
    ".test-dist/app/api/**/route.js",
  ]);
  for (const coverage of [publicCoverage, adminCoverage]) {
    assert.equal(coverage.all, true);
    assert.deepEqual(coverage.exclude, [".test-dist/tests/**/*.js"]);
    assert.equal(coverage["check-coverage"], true);
  }
  assert.deepEqual(
    {
      lines: publicCoverage.lines,
      branches: publicCoverage.branches,
      functions: publicCoverage.functions,
      statements: publicCoverage.statements,
    },
    { lines: 30, branches: 70, functions: 55, statements: 30 },
  );
  assert.deepEqual(
    {
      lines: adminCoverage.lines,
      branches: adminCoverage.branches,
      functions: adminCoverage.functions,
      statements: adminCoverage.statements,
    },
    { lines: 40, branches: 65, functions: 55, statements: 40 },
  );
});

test("admin auth contract docs require OAuth session + admin_users and reject deprecated production auth pathways", () => {
  const checklist = deploymentChecklist();
  const runbook = adminRunbook();
  const adminEnv = adminEnvExample();
  const readme = adminReadme();

  for (const needle of [
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "GOOGLE_OAUTH_REDIRECT_URI",
    "ADMIN_SESSION_SECRET",
    "ADMIN_LOCAL_AUTH_BYPASS_EMAIL",
    "admin_users",
  ]) {
    assert.match(checklist, new RegExp(needle));
    assert.match(runbook, new RegExp(needle));
  }

  for (const needle of ["IAP", "ADMIN_IAP_AUDIENCE", "X-Goog-IAP-JWT-Assertion"]) {
    assert.doesNotMatch(checklist, new RegExp(needle));
    assert.doesNotMatch(readme, new RegExp(needle));
    assert.doesNotMatch(runbook, new RegExp(needle));
  }

  for (const stalePath of [
    "/api/admin/auth/google/callback",
    "/api/admin/auth/callback",
  ]) {
    assert.doesNotMatch(checklist, new RegExp(stalePath));
    assert.doesNotMatch(runbook, new RegExp(stalePath));
    assert.doesNotMatch(readme, new RegExp(stalePath));
  }

  for (const marker of ["/api/admin/auth", "/auth/google"]) {
    assert.doesNotMatch(readme, new RegExp(marker));
    assert.doesNotMatch(runbook, new RegExp(marker));
    assert.doesNotMatch(checklist, new RegExp(marker));
  }

  assert.match(adminEnv, /must be unset|must not be set|must never be set|must never be used in staging\/production|unset or empty/i);
  assert.match(runbook, /No compatibility login stack outside this model|Do not add Firebase|app-level Google OAuth|`admin_users` row/);
  assert.match(runbook, /GOOGLE_OAUTH_REDIRECT_URI is not an OAuth callback URI|OAuth callback/i);
  assert.match(runbook, /\/auth\/callback/);
  assert.match(readme, /Both layers are required|Google OAuth\/OIDC|`admin_users`/);
  assert.match(readme, /\/auth\/callback/);
  assert.match(readme, /run.app/);
  assert.match(checklist, /Admin Cloud Run exposure matches one of the accepted postures/i);
  assert.match(checklist, /run\.app direct/i);
  assert.match(checklist, /restricted\/proxy/i);
});

test("admin docs contain concrete production auth evidence slots", () => {
  const checklist = deploymentChecklist();
  const runbook = adminRunbook();
  const adminEnv = adminEnvExample();

  for (const requiredLine of [
    "ADMIN_LOCAL_AUTH_BYPASS_EMAIL",
    "REVALIDATE_ADMIN_SECRET",
    "PUBLIC_APP_REVALIDATE_URL",
    "admin_users",
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
  ]) {
    assert.match(runbook, new RegExp(requiredLine));
  }

  assert.match(checklist, /Cloud SQL `app_environment`/i);
  assert.match(checklist, /SELECT COUNT\(\*\) AS active_owner_count/);
  assert.match(runbook, /get-iam-policy|Cloud Run invoker/);
  assert.match(runbook, /run\.app direct|run\.app URL|allUsers|allAuthenticatedUsers/);
  assert.match(adminEnv, /GOOGLE_OAUTH_CLIENT_ID=/);
  assert.match(adminEnv, /GOOGLE_OAUTH_CLIENT_SECRET=/);
  assert.match(adminEnv, /GOOGLE_OAUTH_REDIRECT_URI=/);
  assert.match(adminEnv, /ADMIN_SESSION_SECRET=/);
});
