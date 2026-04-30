import Link from "next/link";
import { ArrowRight, CheckCircle2, Database, KeyRound, ShieldCheck } from "lucide-react";

const checklist = [
  "lib/env.ts による環境変数の一元管理",
  "LINE ID Token / Access Token を受ける /api/auth/line 実装",
  "Supabase client / server / admin クライアント分離",
  "bookmarks テーブル前提の実DB保存 API 実装",
  "Supabase migrations を同梱",
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[32px] bg-white p-8 shadow-soft ring-1 ring-brand-100">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr] lg:items-center">
          <div className="space-y-5">
            <span className="inline-flex rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-700">
              設計書準拠の実装ベース
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              LIFF認証・Supabase保存・Vercel配備前提の Next.js 実装を整理済み
            </h1>
            <p className="text-base leading-7 text-slate-600">
              今回の差分では、設計書で要求されていた認証・環境変数・Supabase接続・bookmark実DB化の中核を、
              そのまま次の実装に乗せられる形でファイル化しています。
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/jobs" className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-soft">
                求人一覧を見る
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/saved" className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-5 py-3 text-sm font-semibold text-brand-700">
                保存一覧を見る
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl bg-brand-50 p-5 ring-1 ring-brand-100">
              <div className="mb-3 flex items-center gap-3 text-brand-700">
                <ShieldCheck className="h-5 w-5" />
                <p className="font-semibold">Auth Flow</p>
              </div>
              <p className="text-sm leading-6 text-slate-600">LIFF → /api/auth/line → users upsert → App JWT 発行</p>
            </div>
            <div className="rounded-3xl bg-brand-50 p-5 ring-1 ring-brand-100">
              <div className="mb-3 flex items-center gap-3 text-brand-700">
                <Database className="h-5 w-5" />
                <p className="font-semibold">Bookmarks</p>
              </div>
              <p className="text-sm leading-6 text-slate-600">localStorageではなく Supabase bookmarks テーブルに保存</p>
            </div>
            <div className="rounded-3xl bg-brand-50 p-5 ring-1 ring-brand-100">
              <div className="mb-3 flex items-center gap-3 text-brand-700">
                <KeyRound className="h-5 w-5" />
                <p className="font-semibold">Environment</p>
              </div>
              <p className="text-sm leading-6 text-slate-600">.env.example に LIFF / LINE / Supabase / App URL を整理</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] bg-white p-8 shadow-soft ring-1 ring-brand-100">
        <h2 className="text-xl font-semibold text-slate-900">今回の実装範囲</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {checklist.map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-2xl bg-brand-50 px-4 py-4 ring-1 ring-brand-100">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-brand-600" />
              <p className="text-sm leading-6 text-slate-700">{item}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
