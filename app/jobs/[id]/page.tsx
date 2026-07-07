"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  MapPin,
  JapaneseYen,
  Clock,
  ArrowLeft,
  Share,
  Calendar,
  CheckCircle2,
  Briefcase,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthContext";
import { SaveButton } from "@/components/SaveButton";
import { useSavedItems } from "@/components/SavedItemsContext";
import type { JobDetailDto, JobResponse } from "@/lib/job-dto";
import { siteConfig } from "@/lib/site";

/**
 * 求人詳細ページ
 * - TestAPP の JobDetail.tsx UI を移植 (ネイビー: #1E3A8A / #11204C / #B9C2DB / #F2F4F8)
 * - kakunin の API Routes(/api/jobs/:id) と SaveButton/SavedItems 機能を保持
 * - 応募 CTA は LINE 緑 (#06C755)
 */
export default function JobDetailPage() {
  const params = useParams();
  const slugOrId = params.id as string;
  const router = useRouter();
  const { isLoggedIn, openLoginModal } = useAuth();
  const { isSaved, toggleSaved } = useSavedItems();
  const [job, setJob] = useState<JobDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadJob() {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch(
          `/api/jobs/${encodeURIComponent(slugOrId)}`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as
          | JobResponse
          | { ok: false; error?: { message?: string } };
        if (!response.ok || !data.ok) {
          throw new Error(
            data.ok
              ? "求人の取得に失敗しました"
              : data.error?.message ?? "求人の取得に失敗しました",
          );
        }
        if (!cancelled) setJob(data.item);
      } catch (error) {
        if (!cancelled)
          setLoadError(
            error instanceof Error ? error.message : "求人の取得に失敗しました",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadJob();
    return () => {
      cancelled = true;
    };
  }, [slugOrId]);

  const handleApply = () => {
    if (!job) return;
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }
    const applyUrl = job.applyUrl || siteConfig.defaultApplyUrl;
    if (applyUrl) {
      window.open(applyUrl, "_blank", "noopener,noreferrer");
      return;
    }
    toast.info("応募先URLが未設定です。.env またはデータに applyUrl を追加してください。");
  };

  const handleSave = () => {
    if (!job) return;
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }
    const saved = toggleSaved("job", job.id);
    toast.success(saved ? "求人を保存しました" : "保存を解除しました");
  };

  if (loading) {
    return (
      <div className="w-full max-w-lg mx-auto bg-white min-h-screen animate-slide-in-right p-6 flex flex-col items-center justify-center text-center">
        <Loader2 className="text-[#B9C2DB] mb-4 animate-spin" size={40} />
        <p className="text-sm text-gray-500">求人を読み込んでいます</p>
      </div>
    );
  }

  if (!job || loadError) {
    return (
      <div className="w-full max-w-lg mx-auto bg-white min-h-screen animate-slide-in-right p-6 flex flex-col items-center justify-center text-center">
        <Briefcase className="text-[#B9C2DB] mb-4" size={44} />
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          求人が見つかりません
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {loadError ?? "この求人は削除されたか、まだ登録されていません。"}
        </p>
        <Link
          href="/jobs"
          className="bg-[#1E3A8A] text-white font-bold py-3 px-6 rounded-full hover:bg-[#11204C] transition-colors"
        >
          求人一覧へ戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto bg-white min-h-screen animate-slide-in-right">
      <header className="sticky top-[44px] z-30 bg-white/90 backdrop-blur-md border-b border-[#F2F4F8] px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          aria-label="戻る"
          className="p-2 -ml-2 text-gray-500 hover:bg-gray-50 rounded-full transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="font-bold text-sm text-gray-800">求人詳細</span>
        <button
          onClick={() =>
            navigator.share?.({
              title: job.title,
              url: typeof window !== "undefined" ? window.location.href : "",
            })
          }
          aria-label="共有"
          className="p-2 -mr-2 text-gray-500 hover:bg-gray-50 rounded-full transition-colors"
        >
          <Share size={18} />
        </button>
      </header>

      <div className="p-4 space-y-6 pb-28">
        {/* Title Area */}
        <div>
          <div className="flex gap-2 mb-3 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-0.5 bg-[#B9C2DB]/30 text-[#11204C] rounded">
              {job.category.name}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
              {job.employmentType.name}
            </span>
            {job.requirements ? (
              <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                {job.requirements}
              </span>
            ) : null}
          </div>
          <h2 className="text-xl font-bold text-gray-800 leading-snug mb-3">
            {job.title}
          </h2>
          <div className="flex items-center gap-2 text-sm text-gray-500 border-b border-gray-100 pb-4">
            <div className="w-6 h-6 rounded-full bg-[#F2F4F8] text-[#1E3A8A] flex items-center justify-center font-bold text-xs">
              {job.companyType ?? "求"}
            </div>
            <span>{job.companyName ?? "会社名未設定"}</span>
          </div>
        </div>

        {/* Highlights (TestAPP: bg-[#F2F4F8]/50 カード) */}
        <div className="grid grid-cols-1 gap-2">
          <InfoRow
            icon={<JapaneseYen size={18} />}
            label="給与・報酬"
            value={job.salaryDisplay ?? "未設定"}
          />
          <InfoRow
            icon={<MapPin size={18} />}
            label="勤務地"
            value={job.location ?? "未設定"}
          />
          <InfoRow
            icon={<Clock size={18} />}
            label="勤務時間"
            value={job.schedule ?? "未設定"}
          />
        </div>

        {/* Details */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 border-b border-[#B9C2DB] pb-2">
            <span className="w-1.5 h-4 bg-[#1E3A8A] rounded-full" />
            募集要項
          </h3>
          <div className="text-sm text-gray-600 leading-relaxed space-y-4">
            <p>
              {job.description ||
                job.summary ||
                "求人詳細は管理画面またはデータファイルに追加してください。"}
            </p>
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5 text-sm">
                <CheckCircle2 size={16} className="text-green-500" /> 必須要件
              </h4>
              {job.requirementsList.length > 0 ? (
                <ul className="list-disc list-inside text-xs space-y-1.5 ml-1 text-gray-600">
                  {job.requirementsList.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">必須要件は未設定です。</p>
              )}
            </div>
            {job.benefits.length > 0 ? (
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <h4 className="font-bold text-gray-800 mb-2 text-sm">
                  待遇・補足
                </h4>
                <ul className="list-disc list-inside text-xs space-y-1.5 ml-1 text-gray-600">
                  {job.benefits.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        {/* Info Footer */}
        <div className="text-xs text-gray-400 flex items-center gap-4 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-1">
            <Calendar size={14} /> 掲載日:{" "}
            {job.publishedAt
              ? new Date(job.publishedAt).toLocaleDateString("ja-JP")
              : "未設定"}
          </div>
          <div className="flex items-center gap-1">
            求人ID: {job.id.slice(0, 8)}
          </div>
        </div>
      </div>

      {/* Bottom CTA (TestAPP: 保存 + LINE緑応募ボタン) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#B9C2DB] p-3 pb-safe z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
        <div className="max-w-lg mx-auto flex gap-3">
          <SaveButton saved={isSaved("job", job.id)} onClick={handleSave} />
          <button
            onClick={handleApply}
            className="flex-1 bg-[#06C755] hover:bg-[#05B34C] text-white font-bold rounded-xl flex justify-center items-center gap-2 shadow-sm hover:shadow-md transition-all active:scale-[0.98] py-3"
          >
            LINEで応募する
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[#F2F4F8]/50 p-3 rounded-xl flex items-start gap-3">
      <span className="text-[#1E3A8A] mt-0.5">{icon}</span>
      <div>
        <div className="text-xs text-gray-500 mb-0.5">{label}</div>
        <div className="text-sm font-bold text-gray-800">{value}</div>
      </div>
    </div>
  );
}
