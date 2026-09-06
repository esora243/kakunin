"use client";

import { CalendarDays, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdBanner } from "@/components/AdBanner";
import { SaveButton } from "@/components/SaveButton";
import { useSavedItems } from "@/components/SavedItemsContext";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FilterChip, FilterChipGroup } from "@/components/ui/FilterChip";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import type { ActivityListItemDto } from "@/lib/activity-dto";

export function ActivitiesPageClient({
  initialItems,
  initialError = null,
}: {
  initialItems: ActivityListItemDto[];
  initialError?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const { isSaved, toggleSaved } = useSavedItems();

  const kinds = useMemo(
    () => Array.from(new Map(initialItems.map((item) => [item.kind.code, item.kind])).values()),
    [initialItems],
  );

  const items = useMemo(
    () =>
      initialItems.filter((item) => {
        const text = `${item.title} ${item.hostName} ${item.summary ?? ""} ${item.kind.name}`.toLowerCase();
        return (kind === "all" || item.kind.code === kind) && text.includes(query.trim().toLowerCase());
      }),
    [initialItems, kind, query],
  );

  const hasNarrowedSearch = query.trim() !== "" || kind !== "all";

  return (
    <>
      <AdBanner placement="activities" />

      <PageHeader sticky title="課外活動" description="参加・応募できるプログラムやイベント">
        <SearchInput
          label="課外活動をキーワードで検索"
          clearLabel="課外活動検索をクリア"
          placeholder="活動を検索"
          value={query}
          onChange={setQuery}
        />
        <FilterChipGroup label="活動の種別">
          <FilterChip selected={kind === "all"} onClick={() => setKind("all")}>
            すべて
          </FilterChip>
          {kinds.map((item) => (
            <FilterChip key={item.code} selected={kind === item.code} onClick={() => setKind(item.code)}>
              {item.name}
            </FilterChip>
          ))}
        </FilterChipGroup>
      </PageHeader>

      <Container as="section" aria-label="課外活動一覧" className="space-y-3 py-section">
        {initialError ? (
          <ErrorState
            title="課外活動を取得できませんでした"
            description="通信状態を確認して、もう一度お試しください。"
            detail={initialError}
            icon={Users}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Users}
            title={hasNarrowedSearch ? "条件に合う課外活動は見つかりませんでした" : "公開中の課外活動はまだありません"}
            description={
              hasNarrowedSearch
                ? "キーワードや種別を変えると見つかるかもしれません。"
                : "新しい活動が公開されると、ここに表示されます。"
            }
          />
        ) : (
          items.map((item) => (
            <Card key={item.id} interactive className="p-4">
              <div className="flex justify-between gap-3">
                <Link
                  href={`/activities/${item.slug}`}
                  prefetch={false}
                  className="min-w-0 flex-1 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <span className="text-meta font-bold text-brand-600">{item.kind.name}</span>
                  <h2 className="mt-1 text-body font-bold text-primary">{item.title}</h2>
                  <span className="mt-1 block text-body text-secondary">{item.hostName}</span>
                </Link>
                <SaveButton
                  compact
                  saved={isSaved("activity", item.id)}
                  onClick={() => void toggleSaved("activity", item.id)}
                />
              </div>

              {item.summary ? <p className="mt-3 line-clamp-2 text-body text-secondary">{item.summary}</p> : null}

              <div className="mt-3 flex flex-wrap gap-2 text-meta text-secondary">
                {item.deadlineAt ? (
                  <span className="flex items-center gap-1">
                    <CalendarDays size={13} aria-hidden="true" />
                    締切 {new Date(item.deadlineAt).toLocaleDateString("ja-JP")}
                  </span>
                ) : null}
                {item.location ? (
                  <span className="flex items-center gap-1">
                    <MapPin size={13} aria-hidden="true" />
                    {item.location}
                  </span>
                ) : null}
                <span className="flex items-center gap-1">
                  <Users size={13} aria-hidden="true" />
                  {item.targetAudience ?? "対象指定なし"}
                </span>
              </div>
            </Card>
          ))
        )}
      </Container>
    </>
  );
}
