import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CalendarClock, Check, Inbox, MessageSquareWarning, RefreshCw, TriangleAlert } from "lucide-react";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { loadDashboardData } from "@/lib/dashboard";
import { DatabaseConfigError, dbQuery, getDatabaseRuntimeEnvironment } from "@/lib/db/postgres";
import type { PublishState } from "@/lib/publishing";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Banner } from "@/components/ui/Banner";
import { AccessDenied } from "@/components/AccessDenied";
import { RetryCacheInvalidationButton } from "./RetryCacheInvalidationButton";
import { auditActionLabel, auditResourceLabel, PUBLISH_STATE_LABEL } from "@/lib/operator-labels";
import { formatJapanDateTime } from "@/lib/date-time";

// Root landing page for the admin app. Per docs/admin-management-app-spec.md
// "Admin Domains" (Dashboard: "Counts, alerts, recent changes, read-only
// environment status") and "Launch Scope" ("Dashboard with publish-state
// and operational counts" / "Read-only operational status display on the
// Dashboard").
export const dynamic = "force-dynamic";

type AuditLogRow = {
  actor_admin_id: string | null;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  created_at: string;
};

async function loadRecentAuditLogs(): Promise<AuditLogRow[] | null> {
  try {
    const { rows } = await dbQuery<AuditLogRow>(
      `select l.actor_admin_id, u.email as actor_email, l.action, l.resource_type, l.resource_id, l.created_at
       from admin_audit_logs l
       left join admin_users u on u.id = l.actor_admin_id
       order by l.created_at desc
       limit 10`,
    );
    return rows;
  } catch {
    return null;
  }
}

type EnvironmentStatus =
  | { ok: true; deployEnv: string; databaseEnv: string }
  | { ok: false; code: string; deployEnv: string; databaseEnv: string };

function loadEnvironmentStatus(): EnvironmentStatus {
  try {
    const runtime = getDatabaseRuntimeEnvironment();
    return { ok: true, deployEnv: runtime.deployEnv, databaseEnv: runtime.databaseEnv };
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      return { ok: false, code: error.code, deployEnv: error.deployEnv, databaseEnv: error.databaseEnv };
    }
    return { ok: false, code: "unknown", deployEnv: "invalid", databaseEnv: "invalid" };
  }
}

async function checkDatabaseReachable(): Promise<boolean> {
  try {
    await dbQuery("select 1");
    return true;
  } catch {
    return false;
  }
}

const CONTENT_STATE_ORDER: PublishState[] = ["review", "scheduled", "draft", "approved", "published", "deactivated"];

function MetricLink({ label, value, href, attention = false }: { label: string; value: number; href: string; attention?: boolean }) {
  return (
    <Link
      href={href}
      className="flex min-h-20 items-center justify-between gap-4 rounded-lg border border-stone-200 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
    >
      <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-stone-900">
        {attention && value > 0 ? <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" /> : null}
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 font-mono text-lg font-semibold tabular-nums text-stone-600">{value}</span>
    </Link>
  );
}

function MetricSection({ title, description, action, children }: { title: string; description: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-2 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
          <p className="mt-0.5 text-xs text-stone-500">{description}</p>
        </div>
        {action}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>
    </section>
  );
}

function ActionItem({ icon, label, detail, count, href }: { icon: ReactNode; label: string; detail: string; count: number; href: string }) {
  return (
    <Link
      href={href}
      className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-stone-200 px-4 py-3 first:border-t-0 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
    >
      <span className="text-orange-600">{icon}</span>
      <span>
        <span className="block text-sm font-medium text-stone-900">{label}</span>
        <span className="block text-xs text-stone-500">{detail}</span>
      </span>
      <span className="flex items-center gap-3">
        <span className="font-mono text-lg font-semibold tabular-nums text-stone-900">{count}</span>
        <ArrowRight className="h-4 w-4 text-stone-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

export default async function DashboardPage() {
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;

  const isOwner = identity?.role === "owner";

  const [dashboard, recentAuditLogs, databaseReachable] = await Promise.all([
    loadDashboardData(),
    loadRecentAuditLogs(),
    checkDatabaseReachable(),
  ]);
  const environmentStatus = loadEnvironmentStatus();

  if ("error" in dashboard) {
    return (
      <>
        <PageHeader eyebrow="運営ホーム" title="今日の状況" />
        <Banner variant="error" title="データベースに接続できません">
          {dashboard.error}
        </Banner>
      </>
    );
  }

  return (
    <>
      <PageHeader title="運営ホーム" />

      <section aria-labelledby="needs-action-heading">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="needs-action-heading" className="text-sm font-semibold text-stone-900">要対応</h2>
          <span className="text-xs text-stone-500">優先して確認する項目</span>
        </div>
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          {dashboard.contents.review > 0 ? <ActionItem icon={<TriangleAlert className="h-5 w-5" />} label="確認待ちの記事" detail="内容を確認して承認または修正依頼を行います" count={dashboard.contents.review} href="/contents?state=review" /> : null}
          {dashboard.inquiries.open > 0 ? <ActionItem icon={<MessageSquareWarning className="h-5 w-5" />} label="未対応のお問い合わせ" detail="新しく届いた内容を確認します" count={dashboard.inquiries.open} href="/inquiries?status=open" /> : null}
          {dashboard.contents.scheduled > 0 ? <ActionItem icon={<CalendarClock className="h-5 w-5" />} label="公開予約中の記事" detail="公開日時と内容を確認します" count={dashboard.contents.scheduled} href="/contents?state=scheduled" /> : null}
          {isOwner && dashboard.pendingCacheRetries.length > 0 ? <ActionItem icon={<RefreshCw className="h-5 w-5" />} label="公開サイトへの反映エラー" detail="保存内容の反映を再試行します" count={dashboard.pendingCacheRetries.length} href="#cache-retries" /> : null}
          {dashboard.contents.review === 0 && dashboard.inquiries.open === 0 && dashboard.contents.scheduled === 0 && (!isOwner || dashboard.pendingCacheRetries.length === 0) ? (
            <div className="flex items-center gap-3 px-4 py-4 text-sm text-stone-600"><Check className="h-5 w-5 text-emerald-600" />現在対応が必要な項目はありません</div>
          ) : null}
        </div>
      </section>

      <MetricSection title="記事の公開状況" description="記事が公開工程のどこにあるかを確認できます" action={<Link href="/contents" className="text-xs font-medium text-orange-700 hover:underline">記事一覧へ</Link>}>
        <MetricLink label="全記事" value={dashboard.contents.total} href="/contents" />
        <MetricLink label="有効な記事" value={dashboard.contents.total - dashboard.contents.deactivated} href="/contents" />
        <MetricLink label="記事クリック数" value={dashboard.contents.clicks} href="/contents" />
        {CONTENT_STATE_ORDER.map((state) => <MetricLink key={state} label={PUBLISH_STATE_LABEL[state]} value={dashboard.contents[state]} href={`/contents?state=${state}`} attention={state === "review" || state === "scheduled"} />)}
      </MetricSection>

      <MetricSection title="お問い合わせ" description="受付後の対応状況です" action={<Link href="/inquiries" className="text-xs font-medium text-orange-700 hover:underline">お問い合わせ一覧へ</Link>}>
        <MetricLink label="すべて" value={dashboard.inquiries.open + dashboard.inquiries.inProgress + dashboard.inquiries.closed} href="/inquiries" />
        <MetricLink label="未対応" value={dashboard.inquiries.open} href="/inquiries?status=open" attention />
        <MetricLink label="対応中" value={dashboard.inquiries.inProgress} href="/inquiries?status=in_progress" />
        <MetricLink label="完了" value={dashboard.inquiries.closed} href="/inquiries?status=closed" />
      </MetricSection>

      <MetricSection title="公開情報とファイル" description="サイトで管理している情報の件数です">
        <MetricLink label="求人" value={dashboard.jobs.total} href="/jobs" />
        <MetricLink label="課外活動" value={dashboard.activities.total} href="/activities" />
        <MetricLink label="画像・ファイル" value={dashboard.assets.total} href="/assets" />
        <MetricLink label="削除済みファイル" value={dashboard.assets.deleted} href="/assets?deleted=1" />
        <MetricLink label="広告クリック数" value={dashboard.sponsorClicks.total} href="/" />
      </MetricSection>

      {isOwner ? (
        <MetricSection title="運営メンバー" description="管理画面へアクセスできるメンバーです" action={<Link href="/admin-users" className="text-xs font-medium text-orange-700 hover:underline">メンバー管理へ</Link>}>
          <MetricLink label="有効なメンバー" value={dashboard.adminUsers.activeOwners + dashboard.adminUsers.activeEditors} href="/admin-users" />
          <MetricLink label="管理責任者" value={dashboard.adminUsers.activeOwners} href="/admin-users" />
          <MetricLink label="編集メンバー" value={dashboard.adminUsers.activeEditors} href="/admin-users" />
          <MetricLink label="利用停止中" value={dashboard.adminUsers.inactiveTotal} href="/admin-users" />
        </MetricSection>
      ) : null}

      <div className="mt-8">
        <Card
          title="最近の変更"
          actions={
            isOwner ? (
              <Link href="/audit-logs" className="text-sm text-stone-900 underline decoration-stone-300 hover:decoration-orange-500">
                操作履歴へ
              </Link>
            ) : null
          }
        >
          {recentAuditLogs === null ? (
            <Banner variant="warning" title="操作履歴を取得できませんでした">
              時間を置いて再度読み込んでください。
            </Banner>
          ) : recentAuditLogs.length === 0 ? (
            <EmptyState icon={Inbox} title="まだ変更履歴がありません" />
          ) : (
            <div className="divide-y divide-stone-200">
              {recentAuditLogs.map((log, index) => {
                const actor = log.actor_email ?? "システム";
                return (
                  <div key={`${log.actor_admin_id ?? "system"}-${log.created_at}-${index}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600" aria-hidden="true">{actor.slice(0, 1).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-stone-900"><span className="font-medium">{actor}</span> が {auditResourceLabel(log.resource_type)}を{auditActionLabel(log.action)}</p>
                      <p className="mt-0.5 text-xs text-stone-500">{formatJapanDateTime(log.created_at)} JST</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {isOwner && dashboard.pendingCacheRetries.length > 0 ? (
        <div id="cache-retries" className="mt-8 scroll-mt-4">
          <Card
            title="公開サイトへの反映エラー"
            description="保存後に公開サイトへ反映できなかった項目です。管理責任者が再試行できます。"
          >
            <div className="divide-y divide-stone-200">
              {dashboard.pendingCacheRetries.map((retry) => (
                <div key={retry.id} className="flex flex-wrap items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">{auditResourceLabel(retry.resourceType)}</p>
                    <p className="mt-0.5 truncate font-mono text-xs text-stone-500">{retry.resourceId}</p>
                    {retry.tags.length > 0 ? <p className="mt-1 text-xs text-stone-500">{retry.tags.join(" / ")}</p> : null}
                  </div>
                  <RetryCacheInvalidationButton jobId={retry.id} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      <details className="mt-10 border-t border-stone-200 pt-5 text-stone-500">
        <summary className="cursor-pointer text-xs font-medium">システム状態を確認</summary>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-wider text-stone-400">
        <span className="flex items-center gap-2">
          deploy_env
          <StatusBadge variant="neutral">{environmentStatus.deployEnv}</StatusBadge>
        </span>
        <span className="flex items-center gap-2">
          database_env
          <StatusBadge variant="neutral">{environmentStatus.databaseEnv}</StatusBadge>
        </span>
        <span className="flex items-center gap-2">
          config
          <StatusBadge variant={environmentStatus.ok ? "success" : "danger"}>
            {environmentStatus.ok ? "ok" : environmentStatus.code}
          </StatusBadge>
        </span>
        <span className="flex items-center gap-2">
          database_reachable
          <StatusBadge variant={databaseReachable ? "success" : "danger"}>{databaseReachable ? "ok" : "error"}</StatusBadge>
        </span>
        </div>
      </details>
    </>
  );
}
