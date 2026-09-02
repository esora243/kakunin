import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/LegalDocumentPage";
import { TERMS_OF_SERVICE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "利用規約",
  description: "Hugmeidの利用条件をご確認いただけます。",
};

export default function TermsPage() {
  return <LegalDocumentPage document={TERMS_OF_SERVICE} />;
}
