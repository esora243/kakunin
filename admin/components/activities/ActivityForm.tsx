"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActivityDetailRow, ActivityActionType } from "@/lib/activities";
import type { ActivityKindRow } from "@/lib/master-data";
import { publishStateOf, type PublishState } from "@/lib/publishing";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { FormSection, FieldLabel, TextInput, TextArea, SelectInput, FieldHint } from "@/components/ui/Form";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/StatusBadge";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { isSafePublicUrl, japanLocalDateTimeToIso, operatorSlug } from "@/lib/operator-form";

const ACTIVITY_ACTION_TYPES = ["apply", "signup", "join", "attend", "inquire"] as const;
const ACTION_LABEL: Record<ActivityActionType, string> = { apply: "応募する", signup: "申し込む", join: "参加する", attend: "出席登録する", inquire: "問い合わせる" };

const STATE_LABEL: Record<PublishState, string> = {
  draft: "ドラフト",
  review: "レビュー中",
  approved: "承認済み",
  scheduled: "予約公開",
  published: "公開中",
  deactivated: "無効化",
};

const STATE_BADGE_VARIANT: Record<PublishState, StatusBadgeVariant> = {
  draft: "neutral",
  review: "warning",
  approved: "warning",
  scheduled: "info",
  published: "success",
  deactivated: "danger",
};

const ACTION_SUCCESS_LABEL: Record<"publish" | "unpublish" | "deactivate", string> = {
  publish: "公開しました",
  unpublish: "非公開にしました",
  deactivate: "無効化しました",
};

type FormState = {
  slug: string;
  kind: string;
  title: string;
  hostName: string;
  actionType: ActivityActionType;
  actionUrl: string;
  targetAudience: string;
  locationPref: string;
  locationDetail: string;
  startsAt: string;
  endsAt: string;
  deadlineAt: string;
  capacityDisplay: string;
  summary: string;
  descriptionMd: string;
  requirementsJson: string;
  benefitsJson: string;
  sourceName: string;
  sourceUrl: string;
};

function lines(value: unknown): string {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string").join("\n") : "";
}

function toLocalInput(value: string | null): string {
  return value ? value.slice(0, 16) : "";
}

function toFormState(activity: ActivityDetailRow | null, kinds: ActivityKindRow[]): FormState {
  return {
    slug: activity?.slug ?? "",
    kind: activity?.kind ?? kinds[0]?.code ?? "",
    title: activity?.title ?? "",
    hostName: activity?.host_name ?? "",
    actionType: (activity?.action_type as ActivityActionType | undefined) ?? "apply",
    actionUrl: activity?.action_url ?? "",
    targetAudience: activity?.target_audience ?? "",
    locationPref: activity?.location_pref ?? "",
    locationDetail: activity?.location_detail ?? "",
    startsAt: toLocalInput(activity?.starts_at ?? null),
    endsAt: toLocalInput(activity?.ends_at ?? null),
    deadlineAt: toLocalInput(activity?.deadline_at ?? null),
    capacityDisplay: activity?.capacity_display ?? "",
    summary: activity?.summary ?? "",
    descriptionMd: activity?.description_md ?? "",
    requirementsJson: lines(activity?.requirements_json),
    benefitsJson: lines(activity?.benefits_json),
    sourceName: activity?.source_name ?? "",
    sourceUrl: activity?.source_url ?? "",
  };
}

function toBody(form: FormState) {
  return {
    slug: form.slug,
    kind: form.kind,
    title: form.title,
    hostName: form.hostName,
    actionType: form.actionType,
    actionUrl: form.actionUrl || null,
    targetAudience: form.targetAudience || null,
    locationPref: form.locationPref || null,
    locationDetail: form.locationDetail || null,
    startsAt: form.startsAt || null,
    endsAt: form.endsAt || null,
    deadlineAt: form.deadlineAt || null,
    capacityDisplay: form.capacityDisplay || null,
    summary: form.summary || null,
    descriptionMd: form.descriptionMd || null,
    requirementsJson: form.requirementsJson.split("\n"),
    benefitsJson: form.benefitsJson.split("\n"),
    sourceName: form.sourceName || null,
    sourceUrl: form.sourceUrl || null,
  };
}

async function parseError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  if (response.status === 409 && body?.error?.code === "stale_write") {
    return "別の管理者が更新しました。再読み込みしてください";
  }
  return body?.error?.message ?? fallback;
}

export function ActivityForm({
  mode,
  initialActivity,
  kinds,
}: {
  mode: "create" | "edit";
  initialActivity: ActivityDetailRow | null;
  kinds: ActivityKindRow[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [activity, setActivity] = useState(initialActivity);
  const [form, setForm] = useState(() => toFormState(initialActivity, kinds));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const saveInFlightRef = useRef(false);
  const state = activity ? publishStateOf(activity) : "draft";
  const isPublished = state === "published";
  const isScheduled = state === "scheduled";

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (key === "slug") setSlugEdited(true);
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "title" && mode === "create" && !slugEdited) next.slug = operatorSlug(String(value));
      return next;
    });
  }

  async function save() {
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setSaving(true);
    setError(null);
    setWarning(null);
    try {
      const response =
        mode === "create"
          ? await fetch("/api/activities", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(toBody(form)) })
          : await fetch(`/api/activities/${activity?.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ ...toBody(form), expectedUpdatedAt: activity?.updated_at }),
            });
      if (!response.ok) {
        setError(await parseError(response, "Save failed"));
        return;
      }
      const result = (await response.json()) as { activity: ActivityDetailRow; cacheWarning?: boolean };
      setActivity(result.activity);
      setForm(toFormState(result.activity, kinds));
      if (result.cacheWarning) {
        setWarning("保存しました。公開サイトへの反映に失敗しました。管理責任者が運営ホームから再試行できます。");
      } else {
        toast.success("保存しました");
      }
      if (mode === "create") router.push(`/activities/${result.activity.id}`);
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }

  async function action(actionName: "publish" | "unpublish" | "deactivate") {
    if (!activity) return;
    if (actionName === "deactivate") {
      const ok = await confirm({
        title: "アクティビティを無効化しますか？",
        description: "無効化すると公開画面に表示されなくなります。",
        confirmLabel: "無効化する",
        danger: true,
      });
      if (!ok) return;
    }
    setSaving(true);
    setError(null);
    setWarning(null);
    try {
      const response = await fetch(`/api/activities/${activity.id}/${actionName}`, {
        method: "POST",
        headers: actionName === "publish" ? { "content-type": "application/json" } : undefined,
        body: actionName === "publish" ? JSON.stringify({ scheduledAt: scheduledAt ? japanLocalDateTimeToIso(scheduledAt) : null }) : undefined,
      });
      if (!response.ok) {
        setError(await parseError(response, `${actionName} failed`));
        return;
      }
      const result = (await response.json()) as { activity: ActivityDetailRow; cacheWarning?: boolean };
      setActivity(result.activity);
      setForm(toFormState(result.activity, kinds));
      if (result.cacheWarning) {
        setWarning("操作は完了しました。公開サイトへの反映に失敗しました。管理責任者が運営ホームから再試行できます。");
      } else {
        toast.success(actionName === "publish" && scheduledAt ? "公開を予約しました" : ACTION_SUCCESS_LABEL[actionName]);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="課外活動" title={mode === "create" ? "課外活動を新規作成" : "課外活動を編集"} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-stone-700">状態</span>
          <StatusBadge variant={STATE_BADGE_VARIANT[state]}>{STATE_LABEL[state]}</StatusBadge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
            保存する
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-4">
          <Banner variant="error" title="保存に失敗しました">
            {error}
          </Banner>
        </div>
      ) : null}
      {warning ? (
        <div className="mb-4">
          <Banner variant="warning">{warning}</Banner>
        </div>
      ) : null}

      <Card padding="none">
        <div className="px-6 py-6">
          <FormSection title="基本情報" description="タイトルと主催者と参加方法を設定します">
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="activity-title" required>
                タイトル
              </FieldLabel>
              <TextInput id="activity-title" value={form.title} onChange={(event) => update("title", event.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="activity-host" required>
                主催者
              </FieldLabel>
              <TextInput id="activity-host" value={form.hostName} onChange={(event) => update("hostName", event.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="activity-kind" required>
                種別
              </FieldLabel>
              <SelectInput id="activity-kind" value={form.kind} onChange={(event) => update("kind", event.target.value)}>
                {kinds.map((kind) => (
                  <option key={kind.code} value={kind.code}>
                    {kind.name}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div>
              <FieldLabel htmlFor="activity-action-type" required>
                ボタンに表示する操作
              </FieldLabel>
              <SelectInput
                id="activity-action-type"
                value={form.actionType}
                onChange={(event) => update("actionType", event.target.value as ActivityActionType)}
              >
                {ACTIVITY_ACTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ACTION_LABEL[type]}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="activity-action-url" required>{ACTION_LABEL[form.actionType]}ページ</FieldLabel>
              <TextInput id="activity-action-url" type="url" placeholder="https://example.com/form" value={form.actionUrl} onChange={(event) => update("actionUrl", event.target.value)} />
              <FieldHint>{!form.actionUrl || isSafePublicUrl(form.actionUrl) ? "ボタンを押した利用者が移動するページを入力してください。" : "https:// から始まる正しいURLを入力してください。"}</FieldHint>
            </div>
          </FormSection>

          <FormSection title="開催情報" description="日時・場所・定員・対象">
            <div>
              <FieldLabel htmlFor="activity-starts-at">開始日時</FieldLabel>
              <TextInput
                id="activity-starts-at"
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) => update("startsAt", event.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="activity-ends-at">終了日時</FieldLabel>
              <TextInput
                id="activity-ends-at"
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) => update("endsAt", event.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="activity-deadline-at">締切日時</FieldLabel>
              <TextInput
                id="activity-deadline-at"
                type="datetime-local"
                value={form.deadlineAt}
                onChange={(event) => update("deadlineAt", event.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="activity-capacity-display">定員表示</FieldLabel>
              <TextInput
                id="activity-capacity-display"
                value={form.capacityDisplay}
                onChange={(event) => update("capacityDisplay", event.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="activity-location-pref">開催地（都道府県）</FieldLabel>
              <TextInput
                id="activity-location-pref"
                value={form.locationPref}
                onChange={(event) => update("locationPref", event.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="activity-location-detail">開催地（詳細）</FieldLabel>
              <TextInput
                id="activity-location-detail"
                value={form.locationDetail}
                onChange={(event) => update("locationDetail", event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="activity-target-audience">対象</FieldLabel>
              <TextInput
                id="activity-target-audience"
                value={form.targetAudience}
                onChange={(event) => update("targetAudience", event.target.value)}
              />
            </div>
          </FormSection>

          <FormSection title="内容" description="概要・詳細説明・応募要件">
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="activity-summary">概要</FieldLabel>
              <TextInput id="activity-summary" value={form.summary} onChange={(event) => update("summary", event.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="activity-description">詳細説明</FieldLabel>
              <TextArea
                id="activity-description"
                rows={8}
                value={form.descriptionMd}
                onChange={(event) => update("descriptionMd", event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="activity-requirements">応募要件</FieldLabel>
              <TextArea
                id="activity-requirements"
                rows={5}
                value={form.requirementsJson}
                onChange={(event) => update("requirementsJson", event.target.value)}
              />
              <FieldHint>1行に1件ずつ入力してください。</FieldHint>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="activity-benefits">特典</FieldLabel>
              <TextArea
                id="activity-benefits"
                rows={5}
                value={form.benefitsJson}
                onChange={(event) => update("benefitsJson", event.target.value)}
              />
              <FieldHint>1行に1件ずつ入力してください。</FieldHint>
            </div>
          </FormSection>

          <FormSection title="出典" description="情報の提供元を入力します">
            <div>
              <FieldLabel htmlFor="activity-source-name">出典名</FieldLabel>
              <TextInput id="activity-source-name" value={form.sourceName} onChange={(event) => update("sourceName", event.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="activity-source-url">出典ページ</FieldLabel>
              <TextInput id="activity-source-url" type="url" placeholder="https://example.com" value={form.sourceUrl} onChange={(event) => update("sourceUrl", event.target.value)} />
            </div>
          </FormSection>
          <details className="border-b border-stone-200 py-6">
            <summary className="cursor-pointer text-sm font-medium text-stone-600">詳細設定（通常は変更不要）</summary>
            <div className="mt-4">
              <FieldLabel htmlFor="activity-slug">公開ページ識別子</FieldLabel>
              <TextInput id="activity-slug" value={form.slug} onChange={(event) => update("slug", event.target.value)} />
              <FieldHint>タイトルから自動作成されます。既存URLを維持する必要がある場合のみ変更してください。</FieldHint>
            </div>
          </details>
        </div>
      </Card>

      {activity ? (
        <div className="mt-6">
          <Card title="公開操作" description="公開日時の予約・公開の停止を行います。">
            <div className="flex flex-wrap items-center gap-3">
              {!isPublished ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="rounded-md border border-stone-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40" aria-label="公開日時" />
                  <Button type="button" onClick={() => void action("publish")} disabled={saving}>{scheduledAt ? "公開を予約" : "今すぐ公開"}</Button>
                </div>
              ) : null}
              {isPublished || isScheduled ? (
                <Button type="button" variant="secondary" onClick={() => void action("unpublish")} disabled={saving} className="border-amber-300 text-amber-700 hover:bg-amber-50">
                  {isScheduled ? "公開予約を取り消す" : "非公開にする"}
                </Button>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}

      {activity ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-4">
          <p className="text-sm font-semibold text-red-800">危険な操作</p>
          <p className="mt-1 text-sm text-red-700">無効化すると公開画面に表示されなくなります。</p>
          <div className="mt-3">
            <Button type="button" variant="danger" size="sm" onClick={() => void action("deactivate")} disabled={saving}>
              無効化する
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
