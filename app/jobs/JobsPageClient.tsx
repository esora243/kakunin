"use client";

import { Briefcase, Clock, Filter, JapaneseYen, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { AdBanner } from "@/components/AdBanner";
import { JobFilterModal, type JobFacets } from "@/components/JobFilterModal";
import { SaveButton } from "@/components/SaveButton";
import { useSavedItems } from "@/components/SavedItemsContext";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink, FOCUS_RING } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FilterChip, FilterChipGroup } from "@/components/ui/FilterChip";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import type { JobListItemDto } from "@/lib/job-dto";
import type { FilterOptions } from "@/lib/types";

type JobsPageClientProps = {
  initialJobs: JobListItemDto[];
  initialLoadError: string | null;
};

const uniqueValues = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((a, b) =>
    a.localeCompare(b, "ja"),
  );

export function JobsPageClient({ initialJobs, initialLoadError }: JobsPageClientProps) {
  const { isSaved, toggleSaved } = useSavedItems();
  const [activeTab, setActiveTab] = useState("すべて");
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    employmentType: [],
    jobType: [],
    prefecture: [],
    salaryMin: "",
  });
  const jobs = initialJobs;
  const loadError = initialLoadError;

  const categories = useMemo(
    () => ["すべて", ...uniqueValues(jobs.map((job) => job.category.name))],
    [jobs],
  );

  // 絞り込みの選択肢は一覧の実データから導出する。
  // 静的配列だと「実データに存在しない条件を選ぶと必ず 0 件」になる組み合わせが生じる。
  const facets = useMemo<JobFacets>(
    () => ({
      employmentTypes: uniqueValues(jobs.map((job) => job.employmentType.name)),
      jobTypes: uniqueValues(jobs.map((job) => job.category.name)),
      prefectures: uniqueValues(jobs.map((job) => job.prefecture)),
    }),
    [jobs],
  );

  const filteredJobs = jobs.filter((job) => {
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      const searchableText = [job.title, job.companyName, job.location, job.category.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!searchableText.includes(query)) return false;
    }
    if (activeTab !== "すべて" && job.category.name !== activeTab) return false;
    if (filters.employmentType.length > 0 && !filters.employmentType.includes(job.employmentType.name)) return false;
    if (filters.jobType.length > 0 && !filters.jobType.includes(job.category.name)) return false;
    if (filters.prefecture.length > 0 && (!job.prefecture || !filters.prefecture.includes(job.prefecture))) return false;
    if (filters.salaryMin && (job.salaryMin ?? 0) < Number(filters.salaryMin)) return false;
    return true;
  });

  const activeFilterCount =
    filters.employmentType.length + filters.jobType.length + filters.prefecture.length + (filters.salaryMin ? 1 : 0);
  const hasNarrowedSearch = activeFilterCount > 0 || searchQuery.trim() !== "" || activeTab !== "すべて";

  const clearFilters = () => {
    setFilters({ employmentType: [], jobType: [], prefecture: [], salaryMin: "" });
    setSearchQuery("");
    setActiveTab("すべて");
  };

  return (
    <>
      <AdBanner placement="jobs" />

      <PageHeader sticky title="求人" description="医学生が働ける求人・アルバイト">
        <div className="flex gap-2">
          <SearchInput
            className="flex-1"
            label="求人をフリーワードで絞り込む"
            clearLabel="求人検索をクリア"
            placeholder="フリーワードで絞り込み"
            value={searchQuery}
            onChange={setSearchQuery}
          />
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            aria-label={activeFilterCount > 0 ? `求人を絞り込む（${activeFilterCount}件の条件を適用中）` : "求人を絞り込む"}
            className={`relative inline-flex min-h-tap min-w-tap items-center justify-center rounded-control border border-subtle bg-brand-50 text-brand-500 transition-colors hover:bg-brand-100 ${FOCUS_RING}`}
          >
            <Filter size={20} aria-hidden="true" />
            {activeFilterCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-pill bg-brand-500 text-micro font-bold text-inverse">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </div>

        <FilterChipGroup label="求人カテゴリ">
          {categories.map((category) => (
            <FilterChip key={category} selected={activeTab === category} onClick={() => setActiveTab(category)}>
              {category}
            </FilterChip>
          ))}
        </FilterChipGroup>
      </PageHeader>

      <Container as="section" aria-label="求人一覧" className="space-y-4 py-section">
        {loadError ? (
          <ErrorState
            title="求人を取得できませんでした"
            description="通信状態を確認して、もう一度お試しください。"
            detail={loadError}
            icon={Briefcase}
          />
        ) : filteredJobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={hasNarrowedSearch ? "条件に合う求人は見つかりませんでした" : "公開中の求人はまだありません"}
            description={
              hasNarrowedSearch
                ? "条件を変えると見つかるかもしれません。"
                : "新しい求人が公開されると、ここに表示されます。"
            }
            action={
              hasNarrowedSearch ? (
                <Button variant="secondary" onClick={clearFilters}>
                  絞り込みをクリア
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <p className="text-body text-secondary">{filteredJobs.length}件の求人が見つかりました</p>

            {filteredJobs.map((job) => (
              <Card key={job.id} interactive className="relative p-4">
                <SaveButton
                  compact
                  className="absolute right-2 top-2"
                  saved={isSaved("job", job.id)}
                  onClick={() => void toggleSaved("job", job.id)}
                />

                <div className="mb-2 flex flex-wrap gap-2 pr-tap">
                  <Badge>{job.category.name}</Badge>
                  <Badge tone="info">{job.employmentType.name}</Badge>
                  {job.requirements ? <Badge tone="neutral">{job.requirements}</Badge> : null}
                </div>

                <h2 className="mb-3 text-lead font-bold leading-snug text-primary">{job.title}</h2>
                {job.summary ? <p className="mb-3 line-clamp-2 text-meta text-secondary">{job.summary}</p> : null}

                <dl className="mb-4 space-y-1.5 rounded-control border border-subtle bg-surface-inset p-3 text-meta text-secondary">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={14} className="shrink-0 text-brand-400" aria-hidden="true" />
                    <dt className="sr-only">勤務地</dt>
                    <dd>{job.location ?? "未設定"}</dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <JapaneseYen size={14} className="shrink-0 text-brand-400" aria-hidden="true" />
                    <dt className="sr-only">給与</dt>
                    <dd>{job.salaryDisplay ?? "未設定"}</dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="shrink-0 text-brand-400" aria-hidden="true" />
                    <dt className="sr-only">勤務時間</dt>
                    <dd>{job.schedule ?? "未設定"}</dd>
                  </div>
                </dl>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2 text-meta text-secondary">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-brand-100 text-micro font-bold text-brand-500">
                      {job.companyType ?? "求"}
                    </span>
                    <span className="line-clamp-1">{job.companyName ?? "会社名未設定"}</span>
                  </div>
                  <ButtonLink href={`/jobs/${job.slug}`} prefetch={false} size="sm" className="shrink-0">
                    詳細を見る
                  </ButtonLink>
                </div>
              </Card>
            ))}
          </>
        )}
      </Container>

      <JobFilterModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onApplyFilters={setFilters}
        facets={facets}
      />
    </>
  );
}
