export type ActivityActionType = "apply" | "signup" | "join" | "attend" | "inquire";

export type ActivityListItemDto = {
  id: string;
  slug: string;
  kind: { code: string; name: string };
  title: string;
  hostName: string;
  summary: string | null;
  actionType: ActivityActionType;
  targetAudience: string | null;
  location: string | null;
  startsAt: string | null;
  endsAt: string | null;
  deadlineAt: string | null;
  capacityDisplay: string | null;
  publishedAt: string | null;
  isSaved: boolean;
};

export type ActivityDetailDto = ActivityListItemDto & {
  description: string | null;
  actionUrl: string | null;
  requirements: string[];
  benefits: string[];
  source: {
    sourceName: string | null;
    sourceUrl: string | null;
    sourceLastModifiedAt: string | null;
    syncedAt: string;
  };
};

export type ActivityBookmarkDto = {
  id: string;
  type: "activity";
  activity: ActivityListItemDto;
  savedAt: string;
};
