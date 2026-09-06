import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { siteConfig } from "@/lib/site";
import { ContactPanel } from "./ContactPanel";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: "掲載・提携相談、サービスへの質問、不具合を問い合わせる",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-surface-canvas pb-20">
      <PageHeader
        sticky
        title="お問い合わせ"
        description="掲載・提携相談、サービスへの質問、不具合を運営へ連絡する"
        actions={
          <Link
            href="/profile"
            prefetch={false}
            aria-label="マイページへ戻る"
            className="inline-flex min-h-tap min-w-tap items-center justify-center rounded-pill text-secondary transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
        }
      />
      <Container className="py-section">
        <ContactPanel contactEmail={siteConfig.contactEmail} />
      </Container>
    </div>
  );
}
