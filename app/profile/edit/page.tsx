import type { Metadata } from "next";
import { AuthBoundary } from "@/components/AuthBoundary";
import { ProfileEditPageClient } from "@/app/profile/edit/ProfileEditPageClient";

export const metadata: Metadata = {
  title: "プロフィール編集",
  description: "大学・卒業年度・部活などの登録内容を編集できます。",
};

export default function ProfileEditPage() {
  return (
    <AuthBoundary>
      <ProfileEditPageClient />
    </AuthBoundary>
  );
}
