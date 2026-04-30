"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Bookmark, Building2, MapPin, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthContext";
import { useJobBookmarks } from "@/hooks/useJobBookmarks";

type JobDetail = {
  id: string;
  title: string;
  company_name: string;
  description: string | null;
  prefecture: string | null;
  location: string | null;
  location_type: string | null;
  employment_type: string | null;
  job_type: string | null;
  salary: string | null;
  salary_display: string | null;
  schedule: string | null;
  requirements: string[] | null;
  apply_url: string | null;
};

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const { isLoggedIn, openLoginModal } = useAuth();
  const { isSaved, toggle } = useJobBookmarks();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const res = await fetch(`/api/jobs/${params.id}`, { cache: "no-store" });
        const data = (await res.json()) as { job?: JobDetail };
        if (!res.ok) throw new Error();
        setJob(data.job ?? null);
      } catch {
        toast.error("求人詳細の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      void fetchJob();
    }
  }, [params.id]);

  const handleSave = async () => {
    if (!job) return;
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }
    const next = await toggle(job.id);
    toast.success(next ? "求人を保存しました" : "保存を解除しました");
  };

  if (loading) {
    return <div className="rounded-[28px] bg-white p-8 text-sm text-slate-500 shadow-soft ring-1 ring-brand-100">読み込み中...</div>;
  }

  if (!job) {
    return <div className="rounded-[28px] bg-white p-8 text-sm text-slate-500 shadow-soft ring-1 ring-brand-100">求人が見つかりませんでした。</div>;
  }

  return (
    <div className="space-y-6">
      <Link href="/jobs" className="inline-flex items-center gap-2 text-sm font-medium text-brand-700">
        <ArrowLeft className="h-4 w-4" />
        求人一覧へ戻る
      </Link>

      <article className="rounded-[32px] bg-white p-8 shadow-soft ring-1 ring-brand-100">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {job.job_type && <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">{job.job_type}</span>}
              {job.employment_type && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{job.employment_type}</span>}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{job.title}</h1>
              <p className="mt-2 inline-flex items-center gap-2 text-slate-500"><Building2 className="h-4 w-4 text-brand-600" />{job.company_name}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">勤務地</p>
                <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700"><MapPin className="h-4 w-4 text-brand-600" />{job.location || job.prefecture || job.location_type || "未設定"}</p>
              </div>
              <div className="rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">給与</p>
                <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700"><Wallet className="h-4 w-4 text-brand-600" />{job.salary_display || job.salary || "要相談"}</p>
              </div>
            </div>
            {job.schedule && (
              <div>
                <h2 className="text-sm font-semibold text-slate-900">勤務スケジュール</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{job.schedule}</p>
              </div>
            )}
            {job.description && (
              <div>
                <h2 className="text-sm font-semibold text-slate-900">仕事内容</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">{job.description}</p>
              </div>
            )}
            {job.requirements && job.requirements.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-slate-900">応募条件</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
                  {job.requirements.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}
          </div>

          <aside className="w-full max-w-sm rounded-[28px] bg-brand-50 p-5 ring-1 ring-brand-100">
            <p className="text-sm font-semibold text-slate-900">アクション</p>
            <div className="mt-4 grid gap-3">
              <button onClick={() => void handleSave()} className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold ${isSaved(job.id) ? "bg-brand-500 text-white" : "bg-white text-brand-700 ring-1 ring-brand-200"}`}>
                <Bookmark className={`h-4 w-4 ${isSaved(job.id) ? "fill-current" : ""}`} />
                {isSaved(job.id) ? "保存済み" : "保存する"}
              </button>
              <a
                href={job.apply_url || "#"}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center justify-center rounded-full px-4 py-3 text-sm font-semibold ${job.apply_url ? "bg-slate-900 text-white" : "cursor-not-allowed bg-slate-200 text-slate-500"}`}
              >
                応募URLを開く
              </a>
            </div>
          </aside>
        </div>
      </article>
    </div>
  );
}
