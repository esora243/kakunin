"use client";

import Link from "next/link";
import { Bookmark, ExternalLink, Lock } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { useJobBookmarks } from "@/hooks/useJobBookmarks";

export default function SavedPage() {
  const { isLoggedIn, openLoginModal, hydrated } = useAuth();
  const { bookmarks, loading } = useJobBookmarks();

  if (!hydrated) {
    return <div className="rounded-[28px] bg-white p-8 text-sm text-slate-500 shadow-soft ring-1 ring-brand-100">認証状態を確認中...</div>;
  }

  if (!isLoggedIn) {
    return (
      <div className="rounded-[32px] bg-white p-10 text-center shadow-soft ring-1 ring-brand-100">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">保存一覧</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">bookmark は users / bookmarks テーブルに紐づくため、閲覧にはログインが必要です。</p>
        <button onClick={openLoginModal} className="mt-6 inline-flex rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-soft">
          LINEでログイン
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] bg-white p-6 shadow-soft ring-1 ring-brand-100">
        <h1 className="text-2xl font-bold text-slate-900">保存済み求人</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">/api/bookmarks から自分の保存済みデータを取得しています。</p>
      </section>

      <section className="grid gap-4">
        {loading ? (
          <div className="rounded-[28px] bg-white p-8 text-sm text-slate-500 shadow-soft ring-1 ring-brand-100">読み込み中...</div>
        ) : bookmarks.length === 0 ? (
          <div className="rounded-[28px] bg-white p-8 text-sm text-slate-500 shadow-soft ring-1 ring-brand-100">まだ保存済み求人はありません。</div>
        ) : (
          bookmarks.map((bookmark) => (
            <article key={bookmark.job_id} className="rounded-[28px] bg-white p-6 shadow-soft ring-1 ring-brand-100">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-brand-700"><Bookmark className="h-4 w-4 fill-current" />保存済み</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">{bookmark.jobs?.title || "削除された求人"}</h2>
                  <p className="mt-1 text-sm text-slate-500">{bookmark.jobs?.company_name || "-"}</p>
                  <p className="mt-3 text-sm text-slate-600">{bookmark.jobs?.salary_display || bookmark.jobs?.salary || "給与未設定"}</p>
                </div>
                <Link href={`/jobs/${bookmark.job_id}`} className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  詳細へ
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
