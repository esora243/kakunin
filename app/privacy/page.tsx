import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/LegalDocumentPage";
import { PRIVACY_POLICY } from "@/lib/legal";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description: "Hugmeidにおける個人情報の取り扱いをご確認いただけます。",
};

export default function PrivacyPage() {
  return <LegalDocumentPage document={PRIVACY_POLICY} />;
}
