import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { AccessDenied } from "@/components/AccessDenied";
import { OwnerOnlyNotice } from "./_components/OwnerOnlyNotice";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

const SECTIONS: { href: string; label: string; depth: string; editable: boolean }[] = [
  {
    href: "/master-data/content-categories",
    label: "記事カテゴリ",
    depth: "記事編集画面に表示するカテゴリを管理します。",
    editable: true,
  },
  {
    href: "/master-data/activity-kinds",
    label: "課外活動の種類",
    depth: "課外活動の種類名と表示順を管理します。",
    editable: true,
  },
  {
    href: "/master-data/job-categories",
    label: "求人カテゴリ",
    depth: "求人編集画面に表示する職種名を管理します。",
    editable: true,
  },
  {
    href: "/master-data/employment-types",
    label: "雇用形態",
    depth: "求人編集画面に表示する雇用形態を管理します。",
    editable: true,
  },
  {
    href: "/master-data/universities",
    label: "大学",
    depth: "閲覧専用です。編集機能はありません。",
    editable: false,
  },
  {
    href: "/master-data/clubs",
    label: "部活・サークル",
    depth: "閲覧専用です。編集機能はありません。",
    editable: false,
  },
  {
    href: "/master-data/specialties",
    label: "専門分野",
    depth: "閲覧専用です。編集機能はありません。",
    editable: false,
  },
];

export default async function MasterDataPage() {
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;
  if (identity.role !== "owner") return <OwnerOnlyNotice />;

  return (
    <div>
      <PageHeader
        eyebrow="運営管理"
        title="選択肢の管理"
        description="記事や求人の入力画面に表示する選択肢を管理できます。"
      />
      <div className="rounded-lg border border-stone-200 bg-white">
        {SECTIONS.map((section, index) => (
          <Link
            key={section.href}
            href={section.href}
            className={
              "flex items-center justify-between gap-4 px-4 py-3 hover:bg-stone-50 " +
              (index === 0 ? "" : "border-t border-stone-200")
            }
          >
            <div>
              <p className="text-sm font-medium text-stone-900">{section.label}</p>
              <p className="mt-0.5 text-xs text-stone-500">{section.depth}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {section.editable ? (
                <StatusBadge variant="neutral">編集可</StatusBadge>
              ) : (
                <StatusBadge variant="muted">閲覧のみ</StatusBadge>
              )}
              <ChevronRight size={16} className="text-stone-400" aria-hidden="true" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
