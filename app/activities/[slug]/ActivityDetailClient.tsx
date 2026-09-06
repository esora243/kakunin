"use client";

import { ExternalLink } from "lucide-react";
import { SaveButton } from "@/components/SaveButton";
import { useSavedItems } from "@/components/SavedItemsContext";
import { ButtonLink } from "@/components/ui/Button";
import { DetailScaffold } from "@/components/ui/DetailScaffold";
import type { ActivityDetailDto } from "@/lib/activity-dto";

const actionLabels = {
  apply: "応募する",
  signup: "申し込む",
  join: "参加する",
  attend: "出席する",
  inquire: "問い合わせる",
};

export function ActivityDetailClient({ item }: { item: ActivityDetailDto }) {
  const { isSaved, toggleSaved } = useSavedItems();

  const facts = [
    { label: "対象", value: item.targetAudience },
    { label: "場所", value: item.location },
    { label: "定員", value: item.capacityDisplay },
    { label: "締切", value: item.deadlineAt ? new Date(item.deadlineAt).toLocaleDateString("ja-JP") : null },
  ].filter((fact) => Boolean(fact.value));

  return (
    <DetailScaffold
      title="課外活動の詳細"
      backLabel="課外活動一覧へ戻る"
      backHref="/activities"
      bottomBar={
        <>
          <SaveButton saved={isSaved("activity", item.id)} onClick={() => void toggleSaved("activity", item.id)} />
          {item.actionUrl ? (
            <ButtonLink
              href={item.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              size="lg"
              fullWidth
              className="flex-1"
            >
              {actionLabels[item.actionType]}
              <ExternalLink size={17} aria-hidden="true" />
            </ButtonLink>
          ) : (
            <ButtonLink
              href={`/contact?intent=activity&activityId=${item.id}`}
              prefetch={false}
              size="lg"
              fullWidth
              className="flex-1"
            >
              この活動について問い合わせる
            </ButtonLink>
          )}
        </>
      }
    >
      <article className="space-y-section">
        <div>
          <span className="text-meta font-bold text-brand-600">{item.kind.name}</span>
          <h1 className="mt-2 text-h1 font-bold leading-snug text-primary">{item.title}</h1>
          <p className="mt-1 text-body text-secondary">{item.hostName}</p>
        </div>

        {facts.length > 0 ? (
          <dl className="grid grid-cols-2 gap-2">
            {facts.map((fact) => (
              <div key={fact.label} className="rounded-control bg-surface-inset p-3">
                <dt className="text-meta text-secondary">{fact.label}</dt>
                <dd className="mt-1 text-body font-medium text-primary">{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="whitespace-pre-wrap leading-7 text-body text-secondary">{item.description}</div>

        {item.requirements.length > 0 ? (
          <section>
            <h2 className="text-h3 font-bold text-primary">参加条件</h2>
            <ul className="mt-2 list-disc pl-5 text-body text-secondary">
              {item.requirements.map((value) => (
                <li key={value}>{value}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="text-meta text-tertiary">
          情報源: {item.source.sourceName ?? "Hugmeid"} / 更新:{" "}
          {new Date(item.source.syncedAt).toLocaleDateString("ja-JP")}
        </p>
      </article>
    </DetailScaffold>
  );
}
