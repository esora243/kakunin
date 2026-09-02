import assert from "node:assert/strict";
import test from "node:test";
import type { ContentRow } from "../lib/contents";
import { mapFaqItems } from "../lib/contents";

function contentRow(overrides: Partial<ContentRow>): ContentRow {
  return {
    id: "content-1",
    slug: "faq-01",
    content_type: "faq",
    category: "faq",
    title: "Question",
    dek: null,
    body_md: "Answer",
    hero_image_url: null,
    related_activity_id: null,
    related_job_id: null,
    published_at: "2026-08-07T00:00:00.000Z",
    content_categories: { code: "faq", name: "FAQ" },
    ...overrides,
  };
}

test("FAQ rows map to question and answer entries in slug order", () => {
  const items = mapFaqItems([
    contentRow({ id: "faq-2", slug: "faq-02", title: "Second", body_md: "Second answer" }),
    contentRow({ id: "article-1", slug: "article", content_type: "article" }),
    contentRow({ id: "faq-1", slug: "faq-01", title: "First", body_md: "First answer" }),
  ]);

  assert.deepEqual(items, [
    { id: "faq-1", slug: "faq-01", question: "First", answer: "First answer" },
    { id: "faq-2", slug: "faq-02", question: "Second", answer: "Second answer" },
  ]);
});

test("FAQ mapping keeps an empty answer safe", () => {
  assert.equal(mapFaqItems([contentRow({ body_md: null })])[0]?.answer, "");
});
