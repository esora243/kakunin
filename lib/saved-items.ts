import type { ActivityBookmarkDto } from "./activity-dto";
import type { ContentBookmarkDto } from "./content-dto";
import type { BookmarkDto } from "./job-dto";

export type SavedItemDto = BookmarkDto | ActivityBookmarkDto | ContentBookmarkDto;
export type SavedItemType = SavedItemDto["type"];

export function savedItemEntityId(item: SavedItemDto) {
  if (item.type === "job") return item.job.id;
  if (item.type === "activity") return item.activity.id;
  return item.content.id;
}
