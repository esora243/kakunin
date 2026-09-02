import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { listActiveContentCategories } from "@/lib/contents";
import { ContentForm } from "@/components/contents/ContentForm";
import { AccessDenied } from "@/components/AccessDenied";
import { listJobRows } from "@/lib/jobs";
import { listActivityRows } from "@/lib/activities";

export const dynamic = "force-dynamic";

export default async function NewContentPage() {
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;

  const [categories, relatedJobs, relatedActivities] = await Promise.all([
    listActiveContentCategories(),
    listJobRows(),
    listActivityRows(),
  ]);

  return <ContentForm mode="create" identity={identity} categories={categories} relatedJobs={relatedJobs} relatedActivities={relatedActivities} initialContent={null} />;
}
