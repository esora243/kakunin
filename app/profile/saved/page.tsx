import type { Metadata } from "next";
import { SavedItemsBoundary } from "@/components/SavedItemsBoundary";
import { ProfileSavedClient } from "./ProfileSavedClient";

export const metadata: Metadata = {
  title: "保存済み",
  description: "保存した求人・課外活動・コンテンツをまとめて確認できます。",
};

export default function ProfileSavedPage() {
  return (
    <SavedItemsBoundary>
      <ProfileSavedClient />
    </SavedItemsBoundary>
  );
}
