import type { Metadata } from "next";
import { listCachedContents } from "@/lib/public-cache";
import type { ContentListItemDto } from "@/lib/content-dto";
import { SavedItemsBoundary } from "@/components/SavedItemsBoundary";
import { ContentsPageClient } from "./ContentsPageClient";

export const metadata: Metadata = {
  title: "コンテンツ",
  description: "学びと選択に役立つ記事・ガイドを読めます。",
};

export default async function ContentsPage() {
  let items: ContentListItemDto[] = []; let error: string | null = null;
  try { items = await listCachedContents(); }
  catch { error = "コンテンツの取得に失敗しました"; }
  return <SavedItemsBoundary><ContentsPageClient initialItems={items} initialError={error} /></SavedItemsBoundary>;
}
