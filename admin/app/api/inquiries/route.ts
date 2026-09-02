import { adminApiRoute } from "@/lib/api-route";
import { listInquiryMetadataRows } from "@/lib/inquiries";
import type { InquiryIntent, InquiryStatus } from "@/lib/inquiries";

const VALID_STATUSES: InquiryStatus[] = ["open", "in_progress", "closed"];
const VALID_INTENTS: InquiryIntent[] = [
  "job",
  "activity",
  "content",
  "school_career",
  "sponsor_partner",
  "problem_report",
  "other",
];

// Safe for both owners and editors: the underlying query never selects
// message body, contact fields, or user_id at all, per
// docs/admin-management-app-spec.md "Inquiries" > "Launch permissions".
export const GET = adminApiRoute("any", async (_identity, request) => {
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const intentParam = url.searchParams.get("intent");
  const relatedTypeParam = url.searchParams.get("relatedType");

  const status = VALID_STATUSES.includes(statusParam as InquiryStatus)
    ? (statusParam as InquiryStatus)
    : undefined;
  const intent = VALID_INTENTS.includes(intentParam as InquiryIntent)
    ? (intentParam as InquiryIntent)
    : undefined;
  const relatedType = ["job", "activity", "content"].includes(relatedTypeParam ?? "")
    ? (relatedTypeParam as "job" | "activity" | "content")
    : undefined;

  const rows = await listInquiryMetadataRows({ status, intent, relatedType });
  return { rows };
});
