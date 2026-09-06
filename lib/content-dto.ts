export type ContentType = "article" | "guide" | "story" | "sponsor_story" | "faq";

export type ContentListItemDto = {
  id: string;
  slug: string;
  type: ContentType;
  category: { code: string; name: string };
  title: string;
  dek: string | null;
  heroImageUrl: string | null;
  publishedAt: string | null;
  isSaved: boolean;
};

export type ContentDetailDto = ContentListItemDto & {
  body: string | null;
  relatedActivitySlug: string | null;
  relatedJobSlug: string | null;
};

export type FaqItemDto = {
  id: string;
  slug: string;
  question: string;
  answer: string;
};

export type ContentBookmarkDto = {
  id: string;
  type: "content";
  content: ContentListItemDto;
  savedAt: string;
};
