import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCachedActivityBySlug } from "@/lib/public-cache";
import { ActivityDetailClient } from "./ActivityDetailClient";
import { SavedItemsBoundary } from "@/components/SavedItemsBoundary";
import { DetailUnavailable } from "@/components/DetailUnavailable";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const item = await getCachedActivityBySlug(slug);
    if (item) return { title: item.title, description: item.summary ?? undefined };
  } catch {
    // メタデータ生成の失敗で画面自体を落とさない。
  }
  return { title: "課外活動" };
}

export default async function ActivityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let item = null;
  try {
    item = await getCachedActivityBySlug(slug);
  } catch {
    return <DetailUnavailable title="課外活動を表示できません" message="課外活動の取得に失敗しました。時間をおいて、もう一度お試しください。" backHref="/activities" backLabel="課外活動一覧へ戻る" />;
  }
  if (!item) notFound();
  return <SavedItemsBoundary><ActivityDetailClient item={item} /></SavedItemsBoundary>;
}
