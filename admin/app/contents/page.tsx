import Link from "next/link";
import { FileText } from "lucide-react";
import { CONTENT_STATE_OPTIONS } from "@/lib/content-workflow";
import { listContentRows, listActiveContentCategories } from "@/lib/contents";
import { CONTENT_TYPES } from "@/lib/content-dto";
import { publishStateOf, type PublishState } from "@/lib/publishing";
import { singleStringParam } from "@/lib/query-params";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { FilterBar, SearchInput, SelectField } from "@/components/ui/FilterBar";
import { TableShell, THead, Th, Tr, Td, TdMono } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/StatusBadge";
import { CONTENT_TYPE_LABEL, PUBLISH_STATE_LABEL } from "@/lib/operator-labels";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const STATE_BADGE_VARIANT: Record<PublishState, StatusBadgeVariant> = {
  published: "success",
  scheduled: "info",
  review: "warning",
  approved: "warning",
  draft: "neutral",
  deactivated: "danger",
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function ContentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = singleStringParam(params.q);
  const type = singleStringParam(params.type);
  const category = singleStringParam(params.category);
  const state = singleStringParam(params.state);

  const [rows, activeCategories] = await Promise.all([
    listContentRows({ q, type, category, state }),
    listActiveContentCategories(),
  ]);
  const hasFilters = Boolean(q || type || category || state);
  const categoryOptions =
    category && !activeCategories.some((option) => option.code === category)
      ? [{ code: category, name: `${category} (inactive)`, display_order: -1, is_active: false }, ...activeCategories]
      : activeCategories;

  return (
    <div>
      <PageHeader
        eyebrow="記事"
        title="記事一覧"
        description="公開中の記事と下書きを確認できます。"
        meta={<span>{rows.length} 件</span>}
        actions={
          <Link href="/contents/new" className="inline-flex">
            <Button size="sm">記事を作成</Button>
          </Link>
        }
      />

      <FilterBar clearHref={hasFilters ? "/contents" : undefined}>
        <SearchInput name="q" defaultValue={q ?? ""} label="キーワード" placeholder="タイトルまたは要約で検索" />
        <SelectField
          name="type"
          defaultValue={type ?? ""}
          label="記事の種類"
          options={[{ value: "", label: "すべて" }, ...CONTENT_TYPES.map((option) => ({ value: option, label: CONTENT_TYPE_LABEL[option] }))]}
        />
        <SelectField
          name="category"
          defaultValue={category ?? ""}
          label="カテゴリ"
          options={[
            { value: "", label: "すべて" },
            ...categoryOptions.map((option) => ({ value: option.code, label: option.name })),
          ]}
        />
        <SelectField
          name="state"
          defaultValue={state ?? ""}
          label="公開状態"
          options={[
            { value: "", label: "すべて" },
            ...CONTENT_STATE_OPTIONS.map((option) => ({ value: option, label: PUBLISH_STATE_LABEL[option] })),
          ]}
        />
      </FilterBar>

      {rows.length === 0 ? (
        <TableShell>
          <THead>
            <Th>タイトル</Th>
            <Th>種類</Th>
            <Th>カテゴリ</Th>
            <Th>公開状態</Th>
            <Th align="right">更新日時</Th>
          </THead>
          <tbody>
            <tr>
              <td colSpan={5}>
                <EmptyState
                  icon={FileText}
                  title={hasFilters ? "条件に一致する記事がありません" : "記事がまだありません"}
                  description={
                    hasFilters
                      ? "検索条件を変更してください。条件をすべて解除することもできます。"
                      : "「記事を作成」から最初の記事を作成してください。"
                  }
                  action={
                    hasFilters ? (
                      <Link href="/contents" className="text-sm text-orange-700 underline">
                        条件をクリア
                      </Link>
                    ) : undefined
                  }
                />
              </td>
            </tr>
          </tbody>
        </TableShell>
      ) : (
        <TableShell>
          <THead>
            <Th>タイトル</Th>
            <Th>種類</Th>
            <Th>カテゴリ</Th>
            <Th>公開状態</Th>
            <Th align="right">更新日時</Th>
          </THead>
          <tbody>
            {rows.map((row) => {
              const state = publishStateOf(row);
              return (
                <Tr key={row.id}>
                  <Td>
                    <Link
                      href={`/contents/${row.id}`}
                      className="font-semibold text-stone-900 underline decoration-stone-300 hover:text-orange-700 hover:decoration-orange-500"
                    >
                      {row.title}
                    </Link>
                  </Td>
                  <Td>{CONTENT_TYPE_LABEL[row.content_type]}</Td>
                  <Td>{row.category}</Td>
                  <Td>
                    <StatusBadge variant={STATE_BADGE_VARIANT[state]}>{PUBLISH_STATE_LABEL[state]}</StatusBadge>
                  </Td>
                  <TdMono align="right">{formatDateTime(row.updated_at)}</TdMono>
                </Tr>
              );
            })}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
