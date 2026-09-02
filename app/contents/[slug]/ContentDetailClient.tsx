"use client";

import { MarkdownContent } from "@/components/MarkdownContent";
import { SaveButton } from "@/components/SaveButton";
import { useSavedItems } from "@/components/SavedItemsContext";
import { ButtonLink } from "@/components/ui/Button";
import { DetailScaffold } from "@/components/ui/DetailScaffold";
import type { ContentDetailDto } from "@/lib/content-dto";

export function ContentDetailClient({ item }: { item: ContentDetailDto }) {
  const { isSaved, toggleSaved } = useSavedItems();

  return (
    <DetailScaffold
      title="コンテンツの詳細"
      backLabel="コンテンツ一覧へ戻る"
      backHref="/contents"
      actions={
        <SaveButton compact saved={isSaved("content", item.id)} onClick={() => void toggleSaved("content", item.id)} />
      }
    >
      <article>
        <span className="text-meta font-bold text-brand-600">{item.category.name}</span>
        <h1 className="mt-2 text-h1 font-bold leading-snug text-primary">{item.title}</h1>
        {item.dek ? <p className="mt-3 text-lead text-secondary">{item.dek}</p> : null}

        <div className="mt-7 text-body text-secondary">
          <MarkdownContent source={item.body} />
        </div>

        {item.relatedActivitySlug || item.relatedJobSlug ? (
          <div className="mt-8 flex flex-wrap gap-2">
            {item.relatedActivitySlug ? (
              <ButtonLink href={`/activities/${item.relatedActivitySlug}`} prefetch={false} variant="secondary">
                関連する活動を見る
              </ButtonLink>
            ) : null}
            {item.relatedJobSlug ? (
              <ButtonLink href={`/jobs/${item.relatedJobSlug}`} prefetch={false} variant="secondary">
                関連する求人を見る
              </ButtonLink>
            ) : null}
          </div>
        ) : null}
      </article>
    </DetailScaffold>
  );
}
