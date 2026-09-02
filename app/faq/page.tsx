import type { Metadata } from "next";
import { ArrowLeft, ChevronDown, HelpCircle, MessageCircle } from "lucide-react";
import Link from "next/link";
import { MarkdownContent } from "@/components/MarkdownContent";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import type { FaqItemDto } from "@/lib/content-dto";
import { listCachedFaqs } from "@/lib/public-cache";

export const metadata: Metadata = {
  title: "よくある質問",
  description: "Hugmeidの利用に関するよくある質問",
};

export default async function FaqPage() {
  let items: FaqItemDto[] = [];
  let error: string | null = null;

  try {
    items = await listCachedFaqs();
  } catch {
    error = "よくある質問の取得に失敗しました";
  }

  return (
    <div className="min-h-screen bg-surface-canvas pb-20">
      <PageHeader
        sticky
        title="よくある質問"
        description="サービスの利用方法や困りごとを確認する"
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
      <Container className="space-y-4 py-section">
        {error ? (
          <ErrorState
            icon={HelpCircle}
            title="よくある質問を取得できませんでした"
            description="時間をおいて再度お試しいただくか、お問い合わせをご利用ください。"
            detail={error}
            action={<ButtonLink href="/contact">お問い合わせへ</ButtonLink>}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={HelpCircle}
            title="よくある質問はまだありません"
            description="お困りの場合は、お問い合わせをご利用ください。"
            action={<ButtonLink href="/contact">お問い合わせへ</ButtonLink>}
          />
        ) : (
          <>
            <section aria-label="よくある質問一覧" className="space-y-3">
              {items.map((item) => (
                <Card key={item.id} as="details" className="group overflow-hidden">
                  <summary className="flex min-h-tap cursor-pointer list-none items-start gap-3 px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 [&::-webkit-details-marker]:hidden">
                    <span className="shrink-0 text-body font-bold text-brand-600">Q.</span>
                    <span className="min-w-0 flex-1 text-body font-bold text-primary">{item.question}</span>
                    <ChevronDown
                      className="shrink-0 text-tertiary transition-transform group-open:rotate-180"
                      size={20}
                      aria-hidden="true"
                    />
                  </summary>
                  <div className="flex items-start gap-3 border-t border-subtle bg-surface-subtle px-4 py-4">
                    <span className="shrink-0 text-body font-bold text-brand-600">A.</span>
                    <div className="min-w-0 flex-1 text-body text-secondary">
                      <MarkdownContent source={item.answer} />
                    </div>
                  </div>
                </Card>
              ))}
            </section>

            <Card className="p-5 text-center">
              <MessageCircle className="mx-auto text-brand-300" size={28} aria-hidden="true" />
              <p className="mt-2 text-body font-bold text-primary">解決しない場合</p>
              <p className="mt-1 text-body text-secondary">お問い合わせから状況をお知らせください。</p>
              <div className="mt-4">
                <ButtonLink href="/contact">お問い合わせへ</ButtonLink>
              </div>
            </Card>
          </>
        )}
      </Container>
    </div>
  );
}
