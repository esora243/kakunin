import { revalidateTag } from "next/cache";
import { handleCacheRevalidation } from "@/lib/cache-revalidation-request";

export const dynamic = "force-dynamic";

// Allowed cache tags mirror lib/public-cache.ts's unstable_cache tags. This
// endpoint exists so the separately-deployed admin app (a different Cloud
// Run service) can invalidate this app's Next.js cache after
// publish-impacting mutations, per docs/admin-management-app-spec.md
// "Cache Boundary".
export async function POST(request: Request) {
  return handleCacheRevalidation(
    request,
    process.env.REVALIDATE_ADMIN_SECRET,
    (tag) => revalidateTag(tag, "max"),
  );
}
