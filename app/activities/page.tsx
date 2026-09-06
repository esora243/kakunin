import type { Metadata } from "next";
import { listCachedActivities } from "@/lib/public-cache";
import type { ActivityListItemDto } from "@/lib/activity-dto";
import { SavedItemsBoundary } from "@/components/SavedItemsBoundary";
import { ActivitiesPageClient } from "./ActivitiesPageClient";

export const metadata: Metadata = {
  title: "課外活動",
  description: "参加・応募できるプログラムやイベントを探せます。",
};

export default async function ActivitiesPage() {
  let items: ActivityListItemDto[] = [];
  let error: string | null = null;
  try {
    items = await listCachedActivities();
  } catch {
    error = "課外活動の取得に失敗しました";
  }
  return <SavedItemsBoundary><ActivitiesPageClient initialItems={items} initialError={error} /></SavedItemsBoundary>;
}
