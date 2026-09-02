import type { InquiryRelatedType } from "./inquiries";

export function relatedTypePredicate(
  relatedType: InquiryRelatedType,
): "i.job_id is not null" | "i.job_id is null and i.activity_id is not null" | "i.job_id is null and i.activity_id is null and i.content_id is not null" | null {
  if (relatedType === "job") return "i.job_id is not null";
  if (relatedType === "activity") return "i.job_id is null and i.activity_id is not null";
  if (relatedType === "content") return "i.job_id is null and i.activity_id is null and i.content_id is not null";
  return null;
}
