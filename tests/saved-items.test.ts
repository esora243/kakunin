import assert from "node:assert/strict";
import test from "node:test";
import { savedItemEntityId, type SavedItemDto } from "../lib/saved-items";

test("saved item lookup covers account-backed jobs, activities, and contents", () => {
  const items: SavedItemDto[] = [
    {
      id: "job-bookmark-1",
      type: "job",
      savedAt: "2026-05-10T00:00:00.000Z",
      job: {
        id: "job-1",
        slug: "sample-job",
        title: "Sample Job",
        category: { code: "clinical", name: "臨床" },
        employmentType: { code: "part_time", name: "アルバイト" },
        prefecture: "静岡県",
        location: "浜松市",
        salaryMin: 1200,
        salaryDisplay: "時給1,200円",
        schedule: "週1日",
        companyName: "Sample Clinic",
        companyType: "clinic",
        requirements: "医学部生",
        summary: "Summary",
        publishedAt: "2026-05-01T00:00:00.000Z",
        isSaved: true,
      },
    },
    {
      id: "activity-bookmark-1",
      type: "activity",
      savedAt: "2026-05-10T00:00:00.000Z",
      activity: {
        id: "activity-1",
        slug: "sample-activity",
        kind: { code: "event", name: "イベント" },
        title: "Sample Activity",
        hostName: "Sample Host",
        summary: "Summary",
        actionType: "signup",
        targetAudience: "医学部生",
        location: "浜松市",
        startsAt: null,
        endsAt: null,
        deadlineAt: null,
        capacityDisplay: null,
        publishedAt: "2026-05-01T00:00:00.000Z",
        isSaved: true,
      },
    },
    {
      id: "content-bookmark-1",
      type: "content",
      savedAt: "2026-05-10T00:00:00.000Z",
      content: {
        id: "content-1",
        slug: "sample-content",
        type: "guide",
        category: { code: "guide", name: "ガイド" },
        title: "Sample Content",
        dek: "Dek",
        heroImageUrl: null,
        publishedAt: "2026-05-01T00:00:00.000Z",
        isSaved: true,
      },
    },
  ];

  assert.deepEqual(items.map((item) => `${item.type}:${savedItemEntityId(item)}`), ["job:job-1", "activity:activity-1", "content:content-1"]);
});
