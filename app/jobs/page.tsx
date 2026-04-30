"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, MapPin, Search, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthContext";
import { useJobBookmarks } from "@/hooks/useJobBookmarks";

type JobItem = {
  id: string;
  title: string;
  company_name: string;
  prefecture: string | null;
  location: string | null;
  location_type: string | null;
  employment_type: string | null;
  job_type: string | null;
  salary: string | null;
  salary_display: string | null;
  schedule: string | null;
  description: string | null;
};

export default function JobsPage() {
  const { isLoggedIn, openLoginModal } = useAuth();
  const { isSaved, toggle, loading: bookmarkLoading } = useJobBookmarks();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const data = (await res.json()) as { jobs?: JobItem[] };
        if (!res.ok) throw new Error(data?.toString());
        setJobs(data.jobs ?? []);
      } catch {
        toast.error("求人一覧の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    void fetchJobs();
  }, []);

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((job) => [job.title, job.company_name, job.prefecture, job.location, job.job_type].join(" ").toLowerCase().includes(q));
  }, [jobs, query]);

  const handleToggleSave = async (jobId: string) => {
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }

    const next = await toggle(jobId);
    toast.success(next ? "求人を保存しました" : "保存を解除しました");
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] bg-white p-6 shadow-soft ring-1 ring-brand-100">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-brand-600">Jobs</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">求人一覧</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">公開済みの jobs テーブルを API 経由で取得し、bookmark は実DB保存します。</p>
          </div>
          <label className="flex w-full max-w-xl items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3">
            <Search className="h-4 w-4 text-brand-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="タイトル・会社名・勤務地で検索"
              className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </label>
        </div>
      </section>

      <section className="grid gap-4">
        {loading ? (
          <div className="rounded-[28px] bg-white p-8 text-sm text-slate-500 shadow-soft ring-1 ring-brand-100">読み込み中...</div>
        ) : filteredJobs.length === 0 ? (
          <div className="rounded-[28px] bg-white p-8 text-sm text-slate-500 shadow-soft ring-1 ring-brand-100">公開中の求人がありません。</div>
        ) : (
          filteredJobs.map((job) => (
            <article key={job.id} className="rounded-[28px] bg-white p-6 shadow-soft ring-1 ring-brand-100">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {job.job_type && <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">{job.job_type}</span>}
                    {job.employment_type && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{job.employment_type}</span>}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">{job.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">{job.company_name}</p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-brand-600" />{job.location || job.prefecture || job.location_type || "未設定"}</span>
                    <span className="inline-flex items-center gap-2"><Wallet className="h-4 w-4 text-brand-600" />{job.salary_display || job.salary || "要相談"}</span>
                  </div>
                  {job.description && <p className="text-sm leading-6 text-slate-600">{job.description}</p>}
                </div>

                <div className="flex flex-row gap-3 md:flex-col">
                  <button
                    onClick={() => void handleToggleSave(job.id)}
                    disabled={bookmarkLoading}
                    className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      isSaved(job.id)
                        ? "bg-brand-500 text-white"
                        : "border border-brand-200 bg-white text-brand-700"
                    }`}
                  >
                    <Bookmark className={`h-4 w-4 ${isSaved(job.id) ? "fill-current" : ""}`} />
                    {isSaved(job.id) ? "保存済み" : "保存"}
                  </button>
                  <Link href={`/jobs/${job.id}`} className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                    詳細を見る
                  </Link>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
