import type { Metadata } from "next";
import { SavedItemsBoundary } from "@/components/SavedItemsBoundary";
import type { JobListItemDto } from "@/lib/job-dto";
import { listCachedJobs } from "@/lib/public-cache";
import { JobsPageClient } from "@/app/jobs/JobsPageClient";

export const metadata: Metadata = {
  title: "求人",
  description: "医学生が働ける求人・アルバイトを探せます。",
};

export default async function JobsPage() {
  let initialJobs: JobListItemDto[] = [];
  let initialLoadError: string | null = null;

  try {
    initialJobs = await listCachedJobs();
  } catch {
    initialLoadError = "求人の取得に失敗しました";
  }

  return (
    <SavedItemsBoundary>
      <JobsPageClient initialJobs={initialJobs} initialLoadError={initialLoadError} />
    </SavedItemsBoundary>
  );
}
