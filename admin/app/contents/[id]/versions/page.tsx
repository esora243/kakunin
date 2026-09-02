import Link from "next/link";
import { notFound } from "next/navigation";
import { History } from "lucide-react";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { getContentRowById, listContentVersions } from "@/lib/contents";
import { AccessDenied } from "@/components/AccessDenied";
import { RestoreVersionButton } from "@/components/contents/RestoreVersionButton";
import { pageUuidParam } from "@/lib/query-params";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

const DIFF_FIELDS = [
  "title",
  "slug",
  "content_type",
  "category",
  "dek",
  "body_md",
  "hero_image_url",
  "published_at",
  "approval_status",
] as const;

const FIELD_LABELS: Record<(typeof DIFF_FIELDS)[number], string> = {
  title: "タイトル",
  slug: "公開ページ識別子",
  content_type: "記事の種類",
  category: "カテゴリ",
  dek: "一覧用の要約",
  body_md: "本文",
  hero_image_url: "記事画像",
  published_at: "公開日時",
  approval_status: "確認状態",
};

function valueOf(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (value == null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function ContentVersionsPage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;
  const routeParams = await params;
  const id = pageUuidParam(routeParams.id);
  if (!id) notFound();
  const content = await getContentRowById(id);
  if (!content) notFound();
  const versions = await listContentVersions(id);
  const current = content as unknown as Record<string, unknown>;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="記事"
        title={`変更履歴: ${content.title}`}
        description="過去に保存した内容と現在の内容を比較できます。"
        actions={
          <Link href={`/contents/${id}`} className={buttonClasses("secondary", "sm")}>
            編集に戻る
          </Link>
        }
      />

      {versions.length === 0 ? (
        <Card padding="none">
          <EmptyState icon={History} title="変更履歴はまだありません" />
        </Card>
      ) : (
        <div className="space-y-4">
          {versions.map((version) => {
            const snapshot = version.snapshot as unknown as Record<string, unknown>;
            const changed = DIFF_FIELDS.filter((field) => valueOf(current, field) !== valueOf(snapshot, field));
            return (
              <Card
                key={version.id}
                title={`${version.version_no}回前の保存内容`}
                description={formatDateTime(version.created_at)}
                actions={identity.role === "owner" ? <RestoreVersionButton contentId={id} versionNo={version.version_no} /> : undefined}
              >
                {changed.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[13px] text-stone-700">
                      <thead className="bg-stone-50">
                        <tr>
                          <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-stone-500">
                            項目
                          </th>
                          <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-stone-500">
                            過去の内容
                          </th>
                          <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-stone-500">
                            現在の内容
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {changed.map((field) => (
                          <tr key={field} className="border-t border-stone-200 align-top">
                            <td className="px-3 py-2 font-medium text-stone-700">{FIELD_LABELS[field]}</td>
                            <td className="max-w-md px-3 py-2 text-stone-500">
                              <div className="max-h-40 overflow-y-auto whitespace-pre-wrap">{valueOf(snapshot, field)}</div>
                            </td>
                            <td className="max-w-md px-3 py-2 text-stone-900">
                              <div className="max-h-40 overflow-y-auto whitespace-pre-wrap">{valueOf(current, field)}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-stone-500">現在の記事との差分はありません。</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
