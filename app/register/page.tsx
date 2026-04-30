"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthContext";
import {
  profileClubOptions,
  profileGenderOptions,
  profileGradeOptions,
  profileSpecialtyOptions,
} from "@/lib/constants/profile-options";

const normalizeGrade = (value: string) => {
  const matched = value.match(/(\d+)/);
  return matched ? Number(matched[1]) : null;
};

export default function RegisterPage() {
  const router = useRouter();
  const { isLoggedIn, token, user, openLoginModal, refreshMe } = useAuth();
  const [name, setName] = useState("");
  const [gender, setGender] = useState(profileGenderOptions[0]);
  const [gradeLabel, setGradeLabel] = useState(profileGradeOptions[0]);
  const [university, setUniversity] = useState("");
  const [club, setClub] = useState(profileClubOptions[0]);
  const [desiredDept, setDesiredDept] = useState(profileSpecialtyOptions[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setGender(user.gender || profileGenderOptions[0]);
      setGradeLabel(user.grade ? `${user.grade}年生` : profileGradeOptions[0]);
      setUniversity(user.university || "");
      setClub(user.club || profileClubOptions[0]);
      setDesiredDept(user.desired_dept || profileSpecialtyOptions[0]);
    }
  }, [user]);

  const canSubmit = useMemo(() => Boolean(name.trim() && university.trim()), [name, university]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      openLoginModal();
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          gender,
          grade: normalizeGrade(gradeLabel),
          university,
          club,
          desired_dept: desiredDept,
        }),
      });

      if (!res.ok) throw new Error();

      await refreshMe();
      toast.success("プロフィールを更新しました");
      router.push("/profile");
    } catch {
      toast.error("プロフィール更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="rounded-[32px] bg-white p-10 text-center shadow-soft ring-1 ring-brand-100">
        <h1 className="text-2xl font-bold text-slate-900">初回プロフィール登録</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">users テーブルの不足項目を埋めるオンボーディング画面です。</p>
        <button onClick={openLoginModal} className="mt-6 inline-flex rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-soft">
          LINEでログイン
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[32px] bg-white p-8 shadow-soft ring-1 ring-brand-100">
      <h1 className="text-2xl font-bold text-slate-900">プロフィール登録・編集</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">設計書の users テーブルに合わせて、必要項目を API 経由で更新します。</p>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">氏名</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-2xl border border-brand-200 px-4 py-3 outline-none focus:border-brand-500" />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">性別</span>
          <select value={gender} onChange={(e) => setGender(e.target.value)} className="rounded-2xl border border-brand-200 px-4 py-3 outline-none focus:border-brand-500">
            {profileGenderOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">学年</span>
          <select value={gradeLabel} onChange={(e) => setGradeLabel(e.target.value)} className="rounded-2xl border border-brand-200 px-4 py-3 outline-none focus:border-brand-500">
            {profileGradeOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>

        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">大学</span>
          <input value={university} onChange={(e) => setUniversity(e.target.value)} className="rounded-2xl border border-brand-200 px-4 py-3 outline-none focus:border-brand-500" />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">部活・サークル</span>
          <select value={club} onChange={(e) => setClub(e.target.value)} className="rounded-2xl border border-brand-200 px-4 py-3 outline-none focus:border-brand-500">
            {profileClubOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">志望科</span>
          <select value={desiredDept} onChange={(e) => setDesiredDept(e.target.value)} className="rounded-2xl border border-brand-200 px-4 py-3 outline-none focus:border-brand-500">
            {profileSpecialtyOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={!canSubmit || saving}
            className="inline-flex rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "保存中..." : "プロフィールを保存"}
          </button>
        </div>
      </form>
    </div>
  );
}
