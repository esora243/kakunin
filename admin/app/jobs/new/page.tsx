import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { AccessDenied } from "@/components/AccessDenied";
import { JobForm } from "@/components/jobs/JobForm";
import { listEmploymentTypes, listJobCategories, listUniversities } from "@/lib/master-data";

export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  const identity = await getAdminIdentityForPage();
  if (!identity || identity.role !== "owner") return <AccessDenied />;
  const [categories, employmentTypes, universities] = await Promise.all([
    listJobCategories(),
    listEmploymentTypes(),
    listUniversities(),
  ]);
  return <JobForm mode="create" initialJob={null} categories={categories} employmentTypes={employmentTypes} universities={universities} />;
}
