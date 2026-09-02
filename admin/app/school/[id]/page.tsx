import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { getSyllabusPageWithClasses } from "@/lib/school";
import { ViewOnlyBanner } from "@/components/ViewOnlyBanner";
import { AccessDenied } from "@/components/AccessDenied";
import { SyllabusClassInlineEdit, SyllabusPageEditControls } from "@/components/school/SchoolEditControls";
import { pageUuidParam } from "@/lib/query-params";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TableShell, THead, Th, Tr, Td } from "@/components/ui/Table";

export const dynamic = "force-dynamic";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400">{children}</p>;
}

const DAY_LABELS: Record<string, string> = { mon: "月", tue: "火", wed: "水", thu: "木", fri: "金", sat: "土", sun: "日" };

function formatSchedule(value: unknown): string {
  if (!value || typeof value !== "object") return "未設定";
  const schedule = value as { day?: unknown; period?: unknown; start?: unknown; end?: unknown };
  const day = typeof schedule.day === "string" ? DAY_LABELS[schedule.day.toLowerCase()] ?? schedule.day : "";
  const period = typeof schedule.period === "number" || typeof schedule.period === "string" ? `${schedule.period}限` : "";
  const time = typeof schedule.start === "string" ? `${schedule.start}${typeof schedule.end === "string" ? `〜${schedule.end}` : ""}` : "";
  return [day ? `${day}曜` : "", period, time].filter(Boolean).join(" ") || "未設定";
}

export default async function SchoolPageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;

  const routeParams = await params;
  const id = pageUuidParam(routeParams.id);
  if (!id) notFound();
  const result = await getSyllabusPageWithClasses(id);
  if (!result) notFound();
  const { page, classes } = result;

  return (
    <div>
      <div className="mb-2">
        <Link
          href="/school"
          className="text-sm text-stone-500 underline decoration-stone-300 hover:text-orange-700 hover:decoration-orange-500"
        >
          &larr; シラバス一覧へ戻る
        </Link>
      </div>
      <PageHeader
        eyebrow="学校・授業"
        title={`${page.university_name} — ${page.academic_year}年度 第${page.term_number}学期`}
      />

      {identity?.role === "owner" ? (
        <div className="mb-6">
          <SyllabusPageEditControls page={page} />
        </div>
      ) : (
        <ViewOnlyBanner domain="シラバス" />
      )}

      <Card title="公開設定" padding="none">
        <div className="space-y-6 px-6 py-6">
          <div>
            <SectionLabel>公開期間</SectionLabel>
            <DescriptionList
              items={[
                {
                  label: "公開状態",
                  value: <StatusBadge variant={page.is_active ? "success" : "danger"}>{page.is_active ? "公開対象" : "利用停止"}</StatusBadge>,
                },
                { label: "開始日", value: page.effective_start_date ?? "未設定", mono: true },
                { label: "終了日", value: page.effective_end_date ?? "未設定", mono: true },
              ]}
            />
          </div>
          <details className="rounded-md border border-stone-200 bg-stone-50 p-4">
            <summary className="cursor-pointer text-sm font-medium text-stone-700">取得元と更新情報を表示</summary>
            <div className="mt-4">
              <DescriptionList items={[
                { label: "取得方法", value: page.is_manual_override ? "管理画面で編集済み" : "公式情報から取得" },
                { label: "取得元", value: page.source_file_url ? <a href={page.source_file_url} target="_blank" rel="noreferrer" className="underline hover:text-orange-700">元データを開く</a> : "未設定" },
                { label: "最終取得", value: formatDateTime(page.synced_at), mono: true },
                { label: "最終更新", value: formatDateTime(page.updated_at), mono: true },
              ]} />
            </div>
          </details>
        </div>
      </Card>

      <div className="mt-6 mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-stone-900">授業一覧</h2>
        <span className="text-sm text-stone-500">{classes.length} 件</span>
      </div>
      <TableShell>
        <THead>
          <Th>授業名</Th>
          <Th>担当教員</Th>
          <Th>日時・教室</Th>
          <Th>教材</Th>
          <Th>状態</Th>
          {identity?.role === "owner" ? <Th>編集</Th> : null}
        </THead>
        <tbody>
          {classes.length === 0 ? (
            <tr>
              <td colSpan={identity?.role === "owner" ? 6 : 5} className="px-4 py-8 text-center text-sm text-stone-400">
                授業が登録されていません
              </td>
            </tr>
          ) : (
            classes.map((entry) => (
              <Tr key={entry.id} className="align-top">
                <Td>{entry.title}</Td>
                <Td>{entry.instructor ?? "-"}</Td>
                <Td>
                  <p>{formatSchedule(entry.schedule)}</p>
                  <p className="mt-0.5 text-xs text-stone-500">{entry.room ?? entry.location ?? "教室未設定"}</p>
                </Td>
                <Td>{entry.resource_count}件 / 課題 {entry.task_count}件</Td>
                <Td>
                  <StatusBadge variant={entry.is_active ? "success" : "danger"}>{entry.is_active ? "利用中" : "利用停止"}</StatusBadge>
                </Td>
                {identity?.role === "owner" ? (
                  <Td>
                    <details>
                      <summary className="cursor-pointer text-sm font-medium text-orange-700">編集</summary>
                      <div className="mt-3"><SyllabusClassInlineEdit entry={entry} /></div>
                    </details>
                  </Td>
                ) : null}
              </Tr>
            ))
          )}
        </tbody>
      </TableShell>
    </div>
  );
}
