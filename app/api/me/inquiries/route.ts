import { createInquiryJson } from "@/lib/inquiries";
import { guardedSessionJsonBodyRoute } from "@/lib/next-json-route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return guardedSessionJsonBodyRoute(
    request,
    { code: "inquiry_create_failed", message: "Failed to create inquiry" },
    createInquiryJson,
  );
}
