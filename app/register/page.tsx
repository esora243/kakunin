import type { Metadata } from "next";
import { AuthBoundary } from "@/components/AuthBoundary";
import { RegisterPageClient } from "@/app/register/RegisterPageClient";

export const metadata: Metadata = {
  title: "プロフィール登録",
  description: "5ステップでプロフィールを登録します。",
};

export default function RegisterPage() {
  return (
    <AuthBoundary>
      <RegisterPageClient />
    </AuthBoundary>
  );
}
