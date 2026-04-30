"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Lock, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthContext";

type ProfileUser = {
  id: string;
  name: string | null;
  gender: string | null;
  grade: number | null;
  university: string | null;
  club: string | null;
  desired_dept: string | null;
  created_at: string;
};

export default function ProfilePage() {
  const { isLoggedIn, hydrated, openLoginModal, logout, token, user } = useAuth();
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch("/api/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json()) as { user?: ProfileUser };
        if (!res.ok) throw new Error();
        setProfile(data.user ?? null);
      } catch {
        toast.error("プロフィールの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    void fetchProfile();
  }, [token]);

  if (!hydrated) {
    return <div className="rounded-[28px] bg-white p-8 text-sm text-slate-500 shadow-soft ring-1 ring-brand-100">認証状態を確認中...</div>;
  }

  if (!isLoggedIn) {
    return (
      <div className="rounded-[32px] bg-white p-10 text-center shadow-soft ring-1 ring-brand-100">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">プロフィール</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">LINEログイン後に Supabase 上の users レコードを参照します。</p>
        <button onClick={openLoginModal} className="mt-6 inline-flex rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-soft">
          LINEでログイン
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] bg-white p-6 shadow-soft ring-1 ring-brand-100">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-brand-600">My Profile</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{profile?.name || user?.name || "未設定"}</h1>
            <p className="mt-2 text-sm text-slate-600">{loading ? "読み込み中..." : profile?.university || "大学未設定"}</p>
          </div>
          <button onClick={logout} className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700">
            <LogOut className="h-4 w-4" />
            ログアウト
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {[
          ["学年", profile?.grade ? `${profile.grade}年` : "未設定"],
          ["性別", profile?.gender || "未設定"],
          ["部活", profile?.club || "未設定"],
          ["志望科", profile?.desired_dept || "未設定"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[28px] bg-white p-6 shadow-soft ring-1 ring-brand-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{label}</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </section>

      <Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
        プロフィールを編集する
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
