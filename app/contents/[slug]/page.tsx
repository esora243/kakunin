import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCachedContentBySlug } from "@/lib/public-cache";
import { ContentDetailClient } from "./ContentDetailClient";
import { SavedItemsBoundary } from "@/components/SavedItemsBoundary";
import { DetailUnavailable } from "@/components/DetailUnavailable";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const item = await getCachedContentBySlug(slug);
    if (item) return { title: item.title, description: item.dek ?? undefined };
  } catch {
    // メタデータ生成の失敗で画面自体を落とさない。
  }
  return { title: "コンテンツ" };
}

export default async function ContentDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let item = null;
  try {
    item = await getCachedContentBySlug(slug);
  } catch {
    return <DetailUnavailable title="コンテンツを表示できません" message="コンテンツの取得に失敗しました。時間をおいて、もう一度お試しください。" backHref="/contents" backLabel="コンテンツ一覧へ戻る" />;
  }
  if (!item) notFound();
  return <SavedItemsBoundary><ContentDetailClient item={item}/></SavedItemsBoundary>;
}
