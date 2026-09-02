"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdBanner } from "@/components/AdBanner";
import { SaveButton } from "@/components/SaveButton";
import { useSavedItems } from "@/components/SavedItemsContext";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FilterChip, FilterChipGroup } from "@/components/ui/FilterChip";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import type { ContentListItemDto } from "@/lib/content-dto";

const typeLabels = {
  article: "記事",
  guide: "ガイド",
  story: "体験談",
  sponsor_story: "スポンサー",
};

type ListedContentType = keyof typeof typeLabels;

function isListedContentType(type: ContentListItemDto["type"]): type is ListedContentType {
  return type !== "faq";
}

export function ContentsPageClient({
  initialItems,
  initialError = null,
}: {
  initialItems: ContentListItemDto[];
  initialError?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const { isSaved, toggleSaved } = useSavedItems();

  const items = useMemo(
    () =>
      initialItems.filter(
        (item): item is ContentListItemDto & { type: ListedContentType } => isListedContentType(item.type),
      ).filter(
        (item) =>
          (type === "all" || item.type === type) &&
          `${item.title} ${item.dek ?? ""} ${item.category.name}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [initialItems, query, type],
  );

  const featured = items[0];
  const recent = featured ? items.slice(1) : items;
  const hasNarrowedSearch = query.trim() !== "" || type !== "all";

  return (
    <>
      <AdBanner placement="contents" />

      <PageHeader sticky title="コンテンツ" description="学びと選択に役立つ記事・ガイド">
        <SearchInput
          label="記事をキーワードで検索"
          clearLabel="コンテンツ検索をクリア"
          placeholder="記事を検索"
          value={query}
          onChange={setQuery}
        />
        <FilterChipGroup label="コンテンツ種別">
          {[["all", "すべて"], ...Object.entries(typeLabels)].map(([key, label]) => (
            <FilterChip key={key} selected={type === key} onClick={() => setType(key)}>
              {label}
            </FilterChip>
          ))}
        </FilterChipGroup>
      </PageHeader>

      <Container as="section" aria-label="コンテンツ一覧" className="space-y-3 py-section">
        {initialError ? (
          <ErrorState
            title="コンテンツを取得できませんでした"
            description="通信状態を確認して、もう一度お試しください。"
            detail={initialError}
            icon={BookOpen}
          />
        ) : !featured ? (
          <EmptyState
            icon={BookOpen}
            title={hasNarrowedSearch ? "条件に合う記事は見つかりませんでした" : "公開中のコンテンツはまだありません"}
            description={
              hasNarrowedSearch
                ? "キーワードや種別を変えると見つかるかもしれません。"
                : "新しい記事が公開されると、ここに表示されます。"
            }
          />
        ) : (
          <>
            {/* 注目記事もカードのトークンを共有する。カード全体が 1 つの導線。 */}
            <Card interactive className="relative">
              <Link
                href={`/contents/${featured.slug}`}
                prefetch={false}
                className="block rounded-card p-5 pr-tap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <Badge>注目の{typeLabels[featured.type]}</Badge>
                <h2 className="mt-3 text-lead font-bold leading-snug text-primary">{featured.title}</h2>
                {featured.dek ? <p className="mt-2 line-clamp-3 text-body text-secondary">{featured.dek}</p> : null}
              </Link>
              <SaveButton
                compact
                className="absolute right-2 top-2"
                saved={isSaved("content", featured.id)}
                onClick={() => void toggleSaved("content", featured.id)}
              />
            </Card>

            {recent.map((item) => (
              <Card key={item.id} interactive className="flex items-start gap-3 p-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-brand-50">
                  <BookOpen className="text-brand-400" size={20} aria-hidden="true" />
                </span>
                <Link
                  href={`/contents/${item.slug}`}
                  prefetch={false}
                  className="min-w-0 flex-1 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <span className="block text-meta text-brand-600">{item.category.name}</span>
                  <h2 className="line-clamp-2 text-body font-bold text-primary">{item.title}</h2>
                  <span className="mt-1 block text-meta text-tertiary">{typeLabels[item.type]}</span>
                </Link>
                <SaveButton
                  compact
                  saved={isSaved("content", item.id)}
                  onClick={() => void toggleSaved("content", item.id)}
                />
              </Card>
            ))}
          </>
        )}
      </Container>
    </>
  );
}
