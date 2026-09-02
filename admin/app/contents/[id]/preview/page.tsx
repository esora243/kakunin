import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { getContentRowById } from "@/lib/contents";
import { renderSanitizedContentHtml } from "@/lib/markdown";
import { publishStateOf, type PublishState } from "@/lib/publishing";
import { AccessDenied } from "@/components/AccessDenied";
import { pageUuidParam } from "@/lib/query-params";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/StatusBadge";
import { CONTENT_TYPE_LABEL, PUBLISH_STATE_LABEL } from "@/lib/operator-labels";

// Preview is only reachable through this authenticated admin page (never a
// public route), and is explicitly noindex, so draft content is never
// exposed to unauthenticated public users. Per docs/admin-management-app-spec.md
// "Preview": draft preview must not require the record to be public.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const STATE_BADGE_VARIANT: Record<PublishState, StatusBadgeVariant> = {
  published: "success",
  scheduled: "info",
  review: "warning",
  approved: "warning",
  draft: "neutral",
  deactivated: "danger",
};

export default async function ContentPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;

  const routeParams = await params;
  const id = pageUuidParam(routeParams.id);
  if (!id) notFound();
  const content = await getContentRowById(id);
  if (!content) notFound();

  const html = await renderSanitizedContentHtml(content.body_md ?? "");
  const state = publishStateOf(content);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-stone-600">
          <span className="font-medium text-stone-900">これはプレビューです</span>
          <StatusBadge variant={STATE_BADGE_VARIANT[state]}>{PUBLISH_STATE_LABEL[state]}</StatusBadge>
        </div>
        <Link
          href={`/contents/${id}`}
          className="text-sm text-stone-500 underline decoration-stone-300 hover:text-orange-700 hover:decoration-orange-500"
        >
          編集に戻る
        </Link>
      </div>

      <article className="rounded-lg border border-stone-200 bg-white p-8 shadow-sm">
        {content.hero_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={content.hero_image_url} alt="" className="mb-6 w-full rounded-md object-cover" />
        )}
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-stone-400">
          {CONTENT_TYPE_LABEL[content.content_type]} / {content.category}
        </p>
        <h1 className="mb-3 text-2xl font-bold tracking-tight text-stone-900">{content.title}</h1>
        {content.dek && <p className="mb-6 text-base text-stone-500">{content.dek}</p>}
        <div
          className="space-y-4 text-sm leading-relaxed text-stone-700 [&_a]:text-orange-700 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-stone-300 [&_blockquote]:pl-4 [&_blockquote]:text-stone-500 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-stone-900 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-stone-900 [&_img]:rounded-md [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>
    </div>
  );
}
