import Link from "next/link";
import type { LegalDocument } from "@/lib/legal";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";

export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return (
    <div className="min-h-screen bg-surface-canvas pb-12">
      <PageHeader title={document.title} description={document.meta} />
      <Container as="article" className="py-section">
        <div className="rounded-card border border-subtle bg-surface-card p-5 shadow-card sm:p-8">
          <p className="text-body leading-relaxed text-secondary">{document.intro}</p>

          <div className="mt-8 space-y-8">
            {document.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-h2 font-bold text-primary">{section.heading}</h2>
                <div className="mt-3 space-y-3">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="whitespace-pre-wrap text-body leading-relaxed text-secondary">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {document.outro ? <p className="mt-8 text-right text-body text-secondary">{document.outro}</p> : null}
        </div>

        <p className="mt-5 text-center text-caption text-secondary">
          <Link
            href="/school"
            className="font-semibold text-brand-600 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            Hugmeidに戻る
          </Link>
        </p>
      </Container>
    </div>
  );
}
