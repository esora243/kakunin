"use client";

import { Calendar, CheckCircle2, Clock, JapaneseYen, MapPin, Share } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthContext";
import { SaveButton } from "@/components/SaveButton";
import { useSavedItems } from "@/components/SavedItemsContext";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DetailScaffold } from "@/components/ui/DetailScaffold";
import type { JobDetailDto } from "@/lib/job-dto";

export function JobDetailPageClient({ job }: { job: JobDetailDto }) {
  const router = useRouter();
  const { isLoggedIn, openLoginModal } = useAuth();
  const { isSaved, toggleSaved } = useSavedItems();

  const applyUrl = job.applyUrl;

  const handleApply = () => {
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }
    if (!applyUrl) return;
    window.open(applyUrl, "_blank", "noopener,noreferrer");
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: job.title, url: window.location.href });
        return;
      }
      await navigator.clipboard.writeText(window.location.href);
      toast.success("求人ページのURLをコピーしました");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        toast.info("共有をキャンセルしました");
        return;
      }
      toast.error("共有に失敗しました。ブラウザのアドレス欄からURLを手動でコピーしてください。");
    }
  };

  const facts = [
    { icon: JapaneseYen, label: "給与・報酬", value: job.salaryDisplay ?? "未設定" },
    { icon: MapPin, label: "勤務地", value: job.location ?? "未設定" },
    { icon: Clock, label: "勤務時間", value: job.schedule ?? "未設定" },
  ];

  return (
    <DetailScaffold
      title="求人詳細"
      backLabel="前の画面へ戻る"
      onBack={() => router.back()}
      actions={
        <IconButton label="求人を共有" onClick={() => void handleShare()}>
          <Share size={18} aria-hidden="true" />
        </IconButton>
      }
      bottomBar={
        <>
          <SaveButton saved={isSaved("job", job.id)} onClick={() => void toggleSaved("job", job.id)} />
          {/* 応募は外部ページを開く汎用 CTA。LINE 緑は LINE 連携専用なので使わない。 */}
          <Button variant="primary" size="lg" fullWidth disabled={!applyUrl} onClick={handleApply}>
            {applyUrl ? "応募ページを開く" : "応募受付の準備中です"}
          </Button>
        </>
      }
    >
      <div className="space-y-section">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge>{job.category.name}</Badge>
            <Badge tone="info">{job.employmentType.name}</Badge>
            {job.requirements ? <Badge tone="neutral">{job.requirements}</Badge> : null}
          </div>
          <h1 className="mb-3 text-h1 font-bold leading-snug text-primary">{job.title}</h1>
          <div className="flex items-center gap-2 border-b border-subtle pb-4 text-body text-secondary">
            <span className="flex h-6 w-6 items-center justify-center rounded-pill bg-brand-50 text-caption font-bold text-brand-500">
              {job.companyType ?? "求"}
            </span>
            <span>{job.companyName ?? "会社名未設定"}</span>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-2">
          {facts.map((fact) => {
            const Icon = fact.icon;
            return (
              <div key={fact.label} className="flex items-start gap-3 rounded-control bg-surface-inset p-3">
                <Icon className="mt-0.5 shrink-0 text-brand-500" size={18} aria-hidden="true" />
                <div>
                  <dt className="mb-0.5 text-meta text-secondary">{fact.label}</dt>
                  <dd className="text-body font-bold text-primary">{fact.value}</dd>
                </div>
              </div>
            );
          })}
        </dl>

        <section className="space-y-4">
          <h2 className="flex items-center gap-2 border-b border-subtle pb-2 text-h3 font-bold text-primary">
            <span className="h-4 w-1.5 rounded-pill bg-brand-400" aria-hidden="true" />
            募集要項
          </h2>
          <div className="space-y-4 text-body text-secondary">
            <p>{job.description || job.summary || "この求人の詳細情報は準備中です。"}</p>

            <Card className="p-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-body font-bold text-primary">
                <CheckCircle2 size={16} className="text-success-500" aria-hidden="true" /> 必須要件
              </h3>
              {job.requirementsList.length > 0 ? (
                <ul className="ml-1 list-inside list-disc space-y-1.5 text-meta text-secondary">
                  {job.requirementsList.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-meta text-secondary">必須要件は指定されていません。</p>
              )}
            </Card>

            {job.benefits.length > 0 ? (
              <Card className="p-4">
                <h3 className="mb-2 text-body font-bold text-primary">待遇・補足</h3>
                <ul className="ml-1 list-inside list-disc space-y-1.5 text-meta text-secondary">
                  {job.benefits.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>
        </section>

        <div className="flex items-center gap-4 border-t border-subtle pt-4 text-meta text-tertiary">
          <span className="flex items-center gap-1">
            <Calendar size={14} aria-hidden="true" /> 掲載日:{" "}
            {job.publishedAt ? new Date(job.publishedAt).toLocaleDateString("ja-JP") : "未設定"}
          </span>
          <span className="flex items-center gap-1">求人ID: {job.id.slice(0, 8)}</span>
        </div>
      </div>
    </DetailScaffold>
  );
}
