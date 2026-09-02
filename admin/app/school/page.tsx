import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { listSyllabusPageRows } from "@/lib/school";
import { listUniversities } from "@/lib/master-data";
import { boundedNonNegativeIntegerParam, singleStringParam, stringParamFromAllowlist } from "@/lib/query-params";
import { ViewOnlyBanner } from "@/components/ViewOnlyBanner";
import { AccessDenied } from "@/components/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, SelectField } from "@/components/ui/FilterBar";
import { TableShell, THead, Th, Tr, Td, TdMono } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function SchoolPage({
  searchParams,
}: {
  searchParams: Promise<{ universityId?: string; academicYear?: string }>;
}) {
  const params = await searchParams;
  const universityId = singleStringParam(params.universityId);
  const academicYear = boundedNonNegativeIntegerParam(params.academicYear, "Academic year", { min: 1900, max: 9999 });
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;

  const universities = await listUniversities();
  const rows = await listSyllabusPageRows({
    universityId: stringParamFromAllowlist(universityId ?? null, universities.map((university) => university.id)),
    academicYear,
  });
  const hasFilters = Boolean(universityId || academicYear);

  return (
    <div>
      <PageHeader
        eyebrow="学校・授業"
        title="シラバス一覧"
        description="大学と年度を選んで授業情報を確認できます。"
        meta={<span>{rows.length} 件</span>}
      />
      {identity?.role !== "owner" ? <ViewOnlyBanner domain="シラバス" /> : null}

      <FilterBar clearHref={hasFilters ? "/school" : undefined}>
        <SelectField
          name="universityId"
          defaultValue={universityId ?? ""}
          label="大学"
          options={[
            { value: "", label: "大学すべて" },
            ...universities.map((university) => ({ value: university.id, label: university.name })),
          ]}
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-stone-400">年度</span>
          <input
            type="number"
            name="academicYear"
            defaultValue={academicYear ?? ""}
            placeholder="年度"
            className="w-28 rounded-md border border-stone-300 px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
          />
        </label>
      </FilterBar>

      <TableShell>
        <THead>
          <Th>大学</Th>
          <Th>年度</Th>
          <Th>学期</Th>
          <Th>有効</Th>
          <Th align="right">更新日時</Th>
        </THead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5}>
                <EmptyState
                  icon={GraduationCap}
                  title="条件に一致するシラバスがありません"
                  description={
                    hasFilters ? "検索条件を変更してください。条件をすべて解除することもできます。" : "シラバスがまだ登録されていません。"
                  }
                  action={
                    hasFilters ? (
                      <Link href="/school" className="text-sm text-orange-700 underline">
                        条件をクリア
                      </Link>
                    ) : undefined
                  }
                />
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <Tr key={row.id}>
                <Td>
                  <Link href={`/school/${row.id}`} className="font-medium text-stone-900 hover:text-orange-700">
                    {row.university_name}
                  </Link>
                </Td>
                <Td>{row.academic_year}</Td>
                <Td>{row.term_number}</Td>
                <Td>
                  <StatusBadge variant={row.is_active ? "success" : "danger"}>{row.is_active ? "有効" : "無効"}</StatusBadge>
                </Td>
                <TdMono align="right">{formatDateTime(row.updated_at)}</TdMono>
              </Tr>
            ))
          )}
        </tbody>
      </TableShell>
    </div>
  );
}
