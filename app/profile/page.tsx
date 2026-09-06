import type { Metadata } from "next";
import { AuthBoundary } from "@/components/AuthBoundary";
import { ProfilePageClient } from "@/app/profile/ProfilePageClient";

export const metadata: Metadata = {
  title: "マイページ",
  description: "プロフィールや保存済み・通知の設定を確認できます。",
};

export default function ProfilePage() {
  return (
    <AuthBoundary>
      <ProfilePageClient />
    </AuthBoundary>
  );
}
