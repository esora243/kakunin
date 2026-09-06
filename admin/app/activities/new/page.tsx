import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { AccessDenied } from "@/components/AccessDenied";
import { ActivityForm } from "@/components/activities/ActivityForm";
import { listActivityKinds } from "@/lib/master-data";

export const dynamic = "force-dynamic";

export default async function NewActivityPage() {
  const identity = await getAdminIdentityForPage();
  if (!identity || identity.role !== "owner") return <AccessDenied />;
  const kinds = await listActivityKinds();
  return <ActivityForm mode="create" initialActivity={null} kinds={kinds} />;
}
