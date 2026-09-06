import { notFound } from "next/navigation";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { getContentRowById, listActiveContentCategories } from "@/lib/contents";
import { ContentForm } from "@/components/contents/ContentForm";
import { AccessDenied } from "@/components/AccessDenied";
import { pageUuidParam } from "@/lib/query-params";
import { listJobRows } from "@/lib/jobs";
import { listActivityRows } from "@/lib/activities";

export const dynamic = "force-dynamic";

export default async function EditContentPage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;

  const routeParams = await params;
  const id = pageUuidParam(routeParams.id);
  if (!id) notFound();
  const [content, categories, relatedJobs, relatedActivities] = await Promise.all([
    getContentRowById(id),
    listActiveContentCategories(),
    listJobRows(),
    listActivityRows(),
  ]);
  if (!content) notFound();

  return <ContentForm mode="edit" identity={identity} categories={categories} relatedJobs={relatedJobs} relatedActivities={relatedActivities} initialContent={content} />;
}
