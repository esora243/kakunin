"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CONTENT_TYPES, type AdminContentRow, type ContentCategoryOption, type ContentType } from "@/lib/content-dto";
import { publishStateOf, type PublishState } from "@/lib/publishing";
import type { AdminRole } from "@/lib/auth/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/StatusBadge";
import { FormSection, FieldLabel, TextInput, SelectInput, FieldHint } from "@/components/ui/Form";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { japanLocalDateTimeToIso, operatorSlug } from "@/lib/operator-form";
import { CONTENT_TYPE_LABEL, PUBLISH_STATE_LABEL } from "@/lib/operator-labels";
import type { JobListRow } from "@/lib/jobs";
import type { ActivityListRow } from "@/lib/activities";
import { MarkdownEditor } from "@/components/contents/MarkdownEditor";

type FormState = {
  title: string;
  slug: string;
  contentType: ContentType;
  category: string;
  dek: string;
  bodyMd: string;
  heroImageUrl: string;
  relatedActivityId: string;
  relatedJobId: string;
};

const STATE_BADGE_VARIANT: Record<PublishState, StatusBadgeVariant> = {
  published: "success",
  scheduled: "info",
  review: "warning",
  approved: "warning",
  draft: "neutral",
  deactivated: "danger",
};

const APPROVAL_LABEL: Record<AdminContentRow["approval_status"], string> = {
  draft: "未確認",
  in_review: "確認待ち",
  approved: "承認済み",
  changes_requested: "修正待ち",
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toFormState(content: AdminContentRow | null, categories: ContentCategoryOption[]): FormState {
  return {
    title: content?.title ?? "",
    slug: content?.slug ?? "",
    contentType: content?.content_type ?? CONTENT_TYPES[0],
    category: content?.category ?? categories[0]?.code ?? "",
    dek: content?.dek ?? "",
    bodyMd: content?.body_md ?? "",
    heroImageUrl: content?.hero_image_url ?? "",
    relatedActivityId: content?.related_activity_id ?? "",
    relatedJobId: content?.related_job_id ?? "",
  };
}

function toRequestBody(form: FormState) {
  return {
    title: form.title.trim(),
    slug: form.slug.trim(),
    contentType: form.contentType,
    category: form.category,
    bodyMd: form.bodyMd,
    dek: form.dek.trim() || null,
    heroImageUrl: form.heroImageUrl.trim() || null,
    relatedActivityId: form.relatedActivityId.trim() || null,
    relatedJobId: form.relatedJobId.trim() || null,
  };
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  if (response.status === 409 && body?.error?.code === "stale_write") {
    return "別の管理者が更新しました。再読み込みしてください";
  }
  return body?.error?.message ?? fallback;
}

export function ContentForm({
  mode,
  identity,
  categories,
  relatedJobs,
  relatedActivities,
  initialContent,
}: {
  mode: "create" | "edit";
  identity: { role: AdminRole };
  categories: ContentCategoryOption[];
  relatedJobs: JobListRow[];
  relatedActivities: ActivityListRow[];
  initialContent: AdminContentRow | null;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [form, setForm] = useState<FormState>(() => toFormState(initialContent, categories));
  const [content, setContent] = useState<AdminContentRow | null>(initialContent);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const saveInFlightRef = useRef(false);
  const uploadInFlightRef = useRef(false);

  const publishState = content ? publishStateOf(content) : "draft";
  const isPublished = publishState === "published";
  const isScheduled = publishState === "scheduled";
  const slugChangeRequiresConfirmation = Boolean(content?.first_published_at || content?.published_at);
  const canChangeApproval = content ? content.is_active && !content.published_at : false;
  const slugChanged = content ? form.slug.trim() !== content.slug : false;
  const firstPublishedAt = content?.first_published_at || content?.published_at;

  const categoryOptions = useMemo(() => {
    if (content && !categories.some((option) => option.code === content.category)) {
      return [{ code: content.category, name: `${content.category} (inactive)`, display_order: -1, is_active: false }, ...categories];
    }
    return categories;
  }, [categories, content]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (key === "slug") setSlugEdited(true);
    setForm((previous) => {
      const next = { ...previous, [key]: value };
      if (key === "title" && mode === "create" && !slugEdited) next.slug = operatorSlug(String(value));
      return next;
    });
  }

  async function handleHeroUpload(file: File) {
    if (uploadInFlightRef.current) return;
    uploadInFlightRef.current = true;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/assets/upload", { method: "POST", body });
      if (!response.ok) {
        setError(await parseErrorMessage(response, "画像の追加に失敗しました"));
        return;
      }
      const uploaded = (await response.json()) as { publicUrl: string };
      update("heroImageUrl", uploaded.publicUrl);
    } catch {
      setError("通信エラーにより画像を追加できませんでした");
    } finally {
      uploadInFlightRef.current = false;
      setUploading(false);
    }
  }

  async function handleBodyImageUpload(file: File): Promise<string | null> {
    if (uploadInFlightRef.current) return null;
    uploadInFlightRef.current = true;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/assets/upload", { method: "POST", body });
      if (!response.ok) {
        setError(await parseErrorMessage(response, "画像の追加に失敗しました"));
        return null;
      }
      const uploaded = (await response.json()) as { publicUrl: string };
      return uploaded.publicUrl;
    } catch {
      setError("通信エラーにより画像を追加できませんでした");
      return null;
    } finally {
      uploadInFlightRef.current = false;
      setUploading(false);
    }
  }

  async function handleSave() {
    if (saveInFlightRef.current) return;
    setError(null);
    setWarning(null);

    let confirmSlugChange = false;
    if (mode === "edit" && slugChangeRequiresConfirmation && slugChanged) {
      if (identity.role !== "owner") {
        setError("公開ページ識別子は管理責任者のみ変更できます");
        return;
      }
      const confirmed = await confirm({
        title: "スラッグを変更しますか？",
        description:
          "この記事は公開履歴があります。公開ページ識別子を変更すると既存リンクが使えなくなる可能性があります。",
        confirmLabel: "変更して保存する",
        danger: true,
      });
      if (!confirmed) return;
      confirmSlugChange = true;
    }

    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setSaving(true);
    try {
      const requestBody = {
        ...toRequestBody(form),
        ...(mode === "edit" ? { expectedUpdatedAt: content?.updated_at } : {}),
        ...(confirmSlugChange ? { confirmSlugChange: true } : {}),
      };
      const response =
        mode === "create"
          ? await fetch("/api/contents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(requestBody) })
          : await fetch(`/api/contents/${content?.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(requestBody),
            });

      if (!response.ok) {
        setError(await parseErrorMessage(response, "Save failed"));
        return;
      }
      const result = (await response.json()) as {
        content: AdminContentRow;
        cacheWarning: boolean;
        approvalReset?: boolean;
        scheduleCancelled?: boolean;
      };
      setContent(result.content);
      setForm(toFormState(result.content, categories));
      const warnings: string[] = [];
      if (result.scheduleCancelled) {
        warnings.push("変更を保存し、公開予約を取り消しました。内容を再確認してから、もう一度承認・予約してください。");
      } else if (result.approvalReset) {
        warnings.push("変更を保存しました。内容が変わったため確認状態を下書きに戻しました。もう一度確認を依頼してください。");
      }
      if (result.cacheWarning) {
        warnings.push("公開サイトへの反映に失敗しました。管理責任者が運営ホームから再試行できます。");
      }
      if (warnings.length > 0) {
        setWarning(warnings.join(" "));
      } else {
        toast.success("保存しました");
      }
      if (mode === "create") {
        router.push(`/contents/${result.content.id}`);
      }
    } catch {
      setError("Save failed: network error");
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }

  async function handleAction(action: "publish" | "unpublish" | "deactivate" | "reactivate") {
    if (!content) return;
    setError(null);
    setWarning(null);

    if (action === "deactivate") {
      const confirmed = await confirm({
        title: "コンテンツを無効化しますか？",
        description: "無効化すると公開サイトに表示されなくなります。",
        confirmLabel: "無効化する",
        danger: true,
      });
      if (!confirmed) return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/contents/${content.id}/${action}`, {
        method: "POST",
        headers: action === "publish" ? { "content-type": "application/json" } : undefined,
        body: action === "publish" ? JSON.stringify({ scheduledAt: scheduledAt ? japanLocalDateTimeToIso(scheduledAt) : null }) : undefined,
      });
      if (!response.ok) {
        setError(await parseErrorMessage(response, `${action} failed`));
        return;
      }
      const result = (await response.json()) as { content: AdminContentRow; cacheWarning: boolean };
      setContent(result.content);
      setForm(toFormState(result.content, categories));
      if (result.cacheWarning) {
        setWarning("操作は完了しました。公開サイトへの反映に失敗しました。管理責任者が運営ホームから再試行できます。");
      }
    } catch {
      setError(`${action} failed: network error`);
    } finally {
      setSaving(false);
    }
  }

  async function handleApproval(status: "in_review" | "approved" | "changes_requested") {
    if (!content) return;
    setError(null);
    setWarning(null);
    setSaving(true);
    try {
      const response = await fetch(`/api/contents/${content.id}/approval`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        setError(await parseErrorMessage(response, "Approval update failed"));
        return;
      }
      const result = (await response.json()) as { content: AdminContentRow };
      setContent(result.content);
    } catch {
      setError("Approval update failed: network error");
    } finally {
      setSaving(false);
    }
  }

  const showApprovalSection = Boolean(content && canChangeApproval);
  const showPublishSection = Boolean(content && content.is_active);
  const showDangerZone = Boolean(content && identity.role === "owner");

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow="記事" title={mode === "create" ? "記事を新規作成" : "記事を編集"} />

      {error ? (
        <div className="mb-4">
          <Banner variant="error" title="保存に失敗しました">
            {error}
          </Banner>
        </div>
      ) : null}
      {warning ? (
        <div className="mb-4">
          <Banner variant="warning" title="注意">
            {warning}
          </Banner>
        </div>
      ) : null}
      {isPublished ? (
        <div className="mb-4">
          <Banner variant="warning" title="公開中の記事です">
            保存すると公開ページへ即座に反映されます。
          </Banner>
        </div>
      ) : null}
      {content && !content.is_active ? (
        <div className="mb-4">
          <Banner variant="warning" title="無効化されています">
            この記事は現在公開サイトに表示されません。
          </Banner>
        </div>
      ) : null}

      <Card padding="none">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 px-6 py-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <StatusBadge variant={STATE_BADGE_VARIANT[publishState]}>{PUBLISH_STATE_LABEL[publishState]}</StatusBadge>
            {content ? (
              <span className="text-sm text-stone-500">
                確認状態: <span className="font-medium text-stone-700">{APPROVAL_LABEL[content.approval_status]}</span>
              </span>
            ) : null}
            {content?.approved_at ? (
              <span className="text-sm text-stone-500">承認日時: {formatDateTime(content.approved_at)}</span>
            ) : null}
            {firstPublishedAt ? <span className="text-sm text-stone-500">初回公開: {formatDateTime(firstPublishedAt)}</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={saving} onClick={() => void handleSave()}>
              {mode === "create" ? "下書きを保存" : "保存する"}
            </Button>
            {content ? (
              <Link href={`/contents/${content.id}/preview`} target="_blank" className={buttonClasses("secondary", "md")}>
                公開イメージ
              </Link>
            ) : null}
            {content ? (
              <Link href={`/contents/${content.id}/versions`} className={buttonClasses("secondary", "md")}>
                変更履歴
              </Link>
            ) : null}
          </div>
        </div>

        <div className="px-6 py-6">
          <FormSection title="基本情報" description="タイトル・種別・カテゴリ">
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="content-title" required>タイトル</FieldLabel>
              <TextInput id="content-title" value={form.title} onChange={(event) => update("title", event.target.value)} />
            </div>

            <div>
              <FieldLabel htmlFor="content-type">記事の種類</FieldLabel>
              <SelectInput
                id="content-type"
                value={form.contentType}
                onChange={(event) => update("contentType", event.target.value as ContentType)}
              >
                {CONTENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {CONTENT_TYPE_LABEL[type]}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div>
              <FieldLabel htmlFor="content-category">カテゴリ</FieldLabel>
              <SelectInput id="content-category" value={form.category} onChange={(event) => update("category", event.target.value)}>
                {categoryOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.name}
                  </option>
                ))}
              </SelectInput>
            </div>
          </FormSection>

          <FormSection title="本文" description="一覧用の要約と記事本文を入力します">
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="content-dek">一覧用の要約</FieldLabel>
              <TextInput id="content-dek" value={form.dek} onChange={(event) => update("dek", event.target.value)} />
            </div>

            <div className="sm:col-span-2">
              <FieldLabel htmlFor="content-body">本文</FieldLabel>
              <MarkdownEditor
                value={form.bodyMd}
                onChange={(value) => update("bodyMd", value)}
                onUploadImage={handleBodyImageUpload}
                uploadDisabled={uploading}
              />
              <FieldHint>
                見出しや箇条書きにはMarkdown記法を利用できます。HTMLは利用できません。
              </FieldHint>
            </div>
          </FormSection>

          <FormSection title="記事画像" description="一覧と記事上部に表示されます">
            <div className="sm:col-span-2 space-y-2">
              {form.heroImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.heroImageUrl} alt="現在の記事画像" className="h-32 w-auto rounded-md border border-stone-200 object-cover" />
              ) : null}
              <input
                aria-label="記事画像を選択"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleHeroUpload(file);
                }}
                className="block text-sm text-stone-600 file:mr-3 file:rounded-md file:border file:border-stone-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-50"
              />
              {uploading ? <FieldHint>画像を追加しています...</FieldHint> : <FieldHint>画像を選ぶと現在の画像を差し替えます。</FieldHint>}
            </div>
          </FormSection>

          <FormSection title="関連情報" description="必要な場合だけ記事と募集情報を関連付けます">
            <div>
              <FieldLabel htmlFor="content-related-activity">関連する課外活動</FieldLabel>
              <SelectInput id="content-related-activity" value={form.relatedActivityId} onChange={(event) => update("relatedActivityId", event.target.value)}>
                <option value="">関連付けない</option>
                {relatedActivities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}
              </SelectInput>
            </div>
            <div>
              <FieldLabel htmlFor="content-related-job">関連する求人</FieldLabel>
              <SelectInput id="content-related-job" value={form.relatedJobId} onChange={(event) => update("relatedJobId", event.target.value)}>
                <option value="">関連付けない</option>
                {relatedJobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
              </SelectInput>
            </div>

          </FormSection>

          <details className="border-b border-stone-200 py-6">
            <summary className="cursor-pointer text-sm font-medium text-stone-600">詳細設定（通常は変更不要）</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="content-slug">公開ページ識別子</FieldLabel>
              <TextInput id="content-slug" value={form.slug} onChange={(event) => update("slug", event.target.value)} />
              <FieldHint>{mode === "edit" && slugChangeRequiresConfirmation ? "公開後の変更には管理責任者の確認が必要です。既存リンクが使えなくなる可能性があります。" : "タイトルから自動作成されます。通常は変更不要です。"}</FieldHint>
            </div>
            </div>
          </details>
        </div>
      </Card>

      {showApprovalSection ? (
        <div className="mt-6">
          <Card title="公開前の確認" description="別の運営メンバーが内容を確認してから公開します。">
            <div className="flex flex-wrap gap-2">
              {content && content.approval_status !== "in_review" ? (
                <Button type="button" variant="secondary" disabled={saving} onClick={() => void handleApproval("in_review")}>
                  確認を依頼
                </Button>
              ) : null}
              {content && identity.role === "owner" && content.approval_status !== "approved" ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => void handleApproval("approved")}
                  className="border-sky-300 text-sky-700 hover:bg-sky-50"
                >
                  公開を承認
                </Button>
              ) : null}
              {content && identity.role === "owner" && content.approval_status === "in_review" ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => void handleApproval("changes_requested")}
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  修正を依頼
                </Button>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}

      {showPublishSection ? (
        <div className="mt-6">
          <Card title="公開操作" description="公開日時の予約・公開の停止を行います。">
            <div className="flex flex-wrap items-center gap-3">
              {content && publishState !== "published" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(event) => setScheduledAt(event.target.value)}
                    className="rounded-md border border-stone-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
                    aria-label="公開日時"
                  />
                  <Button
                    type="button"
                    disabled={saving || content.approval_status !== "approved"}
                    title={content.approval_status !== "approved" ? "公開前の承認が必要です" : undefined}
                    onClick={() => void handleAction("publish")}
                  >
                    {scheduledAt ? "公開を予約" : "今すぐ公開"}
                  </Button>
                </div>
              ) : null}

              {isPublished || isScheduled ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => void handleAction("unpublish")}
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  {isScheduled ? "公開予約を取り消す" : "非公開にする"}
                </Button>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}

      {showDangerZone ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50/40 p-6">
          <p className="text-[11px] font-medium text-red-600">取り消しに注意が必要な操作</p>
          <p className="mt-1 text-sm text-stone-600">
            無効化すると公開サイトから即座に非表示になります。取り扱いに注意してください。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {content && content.is_active ? (
              <Button type="button" variant="danger" disabled={saving} onClick={() => void handleAction("deactivate")}>
                利用停止にする
              </Button>
            ) : null}
            {content && !content.is_active ? (
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => void handleAction("reactivate")}
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                利用を再開する
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
