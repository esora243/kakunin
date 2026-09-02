import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailUnavailable } from "@/components/DetailUnavailable";
import { SavedItemsBoundary } from "@/components/SavedItemsBoundary";
import { getCachedJobBySlug } from "@/lib/public-cache";
import { JobDetailPageClient } from "@/app/jobs/[slug]/JobDetailPageClient";

type JobDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: JobDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const job = await getCachedJobBySlug(slug);
    if (job) return { title: job.title, description: job.summary ?? undefined };
  } catch {
    // メタデータ生成の失敗で画面自体を落とさない。
  }
  return { title: "求人" };
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { slug } = await params;
  let job = null;

  try {
    job = await getCachedJobBySlug(slug);
  } catch {
    return (
      <DetailUnavailable
        title="求人を表示できません"
        message="求人の取得に失敗しました。時間をおいて、もう一度お試しください。"
        backHref="/jobs"
        backLabel="求人一覧へ戻る"
      />
    );
  }

  if (!job) notFound();

  return (
    <SavedItemsBoundary>
      <JobDetailPageClient job={job} />
    </SavedItemsBoundary>
  );
}
