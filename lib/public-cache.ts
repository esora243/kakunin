import "server-only";

import { unstable_cache } from "next/cache";
import { getActivityBySlug, listActivities } from "@/lib/activities";
import { getContentBySlug, listContents, listFaqs } from "@/lib/contents";
import { getJobBySlug, listJobs } from "@/lib/jobs";
import { listTimetableClasses } from "@/lib/timetable";
import { getProfileOptions } from "@/lib/users";

export const listCachedJobs = unstable_cache(async () => listJobs(), ["public-jobs-v1"], {
  revalidate: 30,
  tags: ["jobs"],
});

export const getCachedJobBySlug = unstable_cache(
  async (slug: string) => getJobBySlug(slug),
  ["public-job-detail-v1"],
  {
    revalidate: 300,
    tags: ["jobs"],
  },
);

export const listCachedActivities = unstable_cache(async () => listActivities(), ["public-activities-v1"], {
  revalidate: 30,
  tags: ["activities"],
});

export const getCachedActivityBySlug = unstable_cache(
  async (slug: string) => getActivityBySlug(slug),
  ["public-activity-detail-v1"],
  {
    revalidate: 300,
    tags: ["activities"],
  },
);

export const listCachedContents = unstable_cache(async () => listContents(), ["public-contents-v1"], {
  revalidate: 30,
  tags: ["contents"],
});

export const listCachedFaqs = unstable_cache(async () => listFaqs(), ["public-faqs-v1"], {
  revalidate: 30,
  tags: ["contents"],
});

export const getCachedContentBySlug = unstable_cache(
  async (slug: string) => getContentBySlug(slug),
  ["public-content-detail-v1"],
  {
    revalidate: 300,
    tags: ["contents"],
  },
);

export const listCachedTimetableClasses = unstable_cache(
  async () => listTimetableClasses(),
  ["public-timetable-v1"],
  {
    revalidate: 30,
    tags: ["timetable"],
  },
);

export const getCachedProfileOptions = unstable_cache(
  async () => getProfileOptions(),
  ["public-profile-options-v2"],
  {
    revalidate: 300,
    tags: ["profile-options"],
  },
);
