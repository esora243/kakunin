import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { getActivityRowById } from "@/lib/activities";
import { listActivityKinds } from "@/lib/master-data";
import { pageUuidParam } from "@/lib/query-params";
import { publishStateOf, type PublishState } from "@/lib/publishing";
import { ViewOnlyBanner } from "@/components/ViewOnlyBanner";
import { AccessDenied } from "@/components/AccessDenied";
import { ActivityForm } from "@/components/activities/ActivityForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

const STATE_LABEL: Record<PublishState, string> = {
  draft: "ドラフト",
  review: "レビュー中",
  approved: "承認済み",
  scheduled: "予約公開",
  published: "公開中",
  deactivated: "無効化",
};

const STATE_BADGE_VARIANT: Record<PublishState, StatusBadgeVariant> = {
  draft: "neutral",
  review: "warning",
  approved: "warning",
  scheduled: "info",
  published: "success",
  deactivated: "danger",
};

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return <>-</>;
  return (
    <ul className="list-inside list-disc space-y-0.5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;

  const routeParams = await params;
  const id = pageUuidParam(routeParams.id);
  if (!id) notFound();
  const activity = await getActivityRowById(id);
  if (!activity) notFound();

  if (identity?.role === "owner") {
    const kinds = await listActivityKinds();
    return <ActivityForm mode="edit" initialActivity={activity} kinds={kinds} />;
  }

  const state = publishStateOf(activity);
  const requirements = asStringArray(activity.requirements_json);
  const benefits = asStringArray(activity.benefits_json);

  return (
    <div>
      <Link
        href="/activities"
        className="text-sm text-stone-500 underline decoration-stone-300 hover:text-orange-700 hover:decoration-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
      >
        &larr; アクティビティ一覧へ戻る
      </Link>
      <PageHeader
        eyebrow="課外活動"
        title={activity.title}
        meta={<StatusBadge variant={STATE_BADGE_VARIANT[state]}>{STATE_LABEL[state]}</StatusBadge>}
      />
      <ViewOnlyBanner domain="アクティビティ" />

      <div className="space-y-6">
        <Card title="基本情報">
          <DescriptionList
            items={[
              { label: "種別", value: activity.kind_name },
              { label: "主催者", value: activity.host_name },
              { label: "スラッグ", value: activity.slug, mono: true },
              { label: "アクション種別", value: activity.action_type },
              {
                label: "アクションURL",
                value: activity.action_url ? (
                  <a
                    href={activity.action_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-stone-900 underline decoration-stone-300 hover:decoration-orange-500"
                  >
                    {activity.action_url}
                  </a>
                ) : (
                  "-"
                ),
              },
            ]}
          />
        </Card>

        <Card title="開催情報">
          <DescriptionList
            items={[
              { label: "開始日時", value: formatDateTime(activity.starts_at), mono: Boolean(activity.starts_at) },
              { label: "終了日時", value: formatDateTime(activity.ends_at), mono: Boolean(activity.ends_at) },
              { label: "締切日時", value: formatDateTime(activity.deadline_at), mono: Boolean(activity.deadline_at) },
              { label: "開催地（都道府県）", value: activity.location_pref ?? "-" },
              { label: "開催地（詳細）", value: activity.location_detail ?? "-" },
              { label: "定員表示", value: activity.capacity_display ?? "-" },
              { label: "対象", value: activity.target_audience ?? "-" },
            ]}
          />
        </Card>

        <Card title="内容">
          <DescriptionList
            items={[
              { label: "概要", value: activity.summary ?? "-" },
              {
                label: "詳細説明",
                value: (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-stone-900">{activity.description_md ?? "-"}</pre>
                ),
              },
              { label: "応募要件", value: <BulletList items={requirements} /> },
              { label: "特典", value: <BulletList items={benefits} /> },
            ]}
          />
        </Card>

        <Card title="出典">
          <DescriptionList
            items={[
              { label: "ソース名", value: activity.source_name ?? "-" },
              {
                label: "ソースURL",
                value: activity.source_url ? (
                  <a
                    href={activity.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-stone-900 underline decoration-stone-300 hover:decoration-orange-500"
                  >
                    {activity.source_url}
                  </a>
                ) : (
                  "-"
                ),
              },
              { label: "公開日時", value: formatDateTime(activity.published_at), mono: Boolean(activity.published_at) },
              {
                label: "外部更新日時",
                value: formatDateTime(activity.source_last_modified_at),
                mono: Boolean(activity.source_last_modified_at),
              },
              { label: "同期日時", value: formatDateTime(activity.synced_at), mono: true },
              { label: "作成日時", value: formatDateTime(activity.created_at), mono: true },
              { label: "更新日時", value: formatDateTime(activity.updated_at), mono: true },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
