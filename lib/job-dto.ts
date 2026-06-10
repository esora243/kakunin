export type JobListItemDto = {
  id: string;
  slug: string;
  title: string;
  category: { code: string; name: string };
  employmentType: { code: string; name: string };
  prefecture: string | null;
  location: string | null;
  salaryMin: number | null;
  salaryDisplay: string | null;
  schedule: string | null;
  companyName: string | null;
  companyType: string | null;
  requirements: string | null;
  summary: string | null;
  publishedAt: string | null;
  isSaved: boolean;
};

export type JobDetailDto = JobListItemDto & {
  description: string | null;
  requirementsList: string[];
  benefits: string[];
  applyUrl: string | null;
  source: {
    externalSource: string;
    externalId: string;
    externalSlug: string | null;
    sourceLastModifiedAt: string | null;
    syncedAt: string;
  };
};

export type JobsResponse = { ok: true; items: JobListItemDto[]; nextCursor: string | null };
export type JobResponse = { ok: true; item: JobDetailDto };
export type ApiErrorResponse = { ok: false; error: { code: string; message: string } };
