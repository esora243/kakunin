"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, User } from "lucide-react";
import { toast } from "sonner";
import {
  profileClubOptions,
  profileGenderOptions,
  profileGradeOptions,
  profileSpecialtyOptions,
} from "@/lib/data";

type UserProfile = {
  gender: string;
  grade: string;
  university: string;
  club: string;
  specialty: string;
};

/**
 * プロフィール編集ページ
 * - Hugmeid mock の ProfileEdit.tsx 準拠:
 *   1) bg-[#F2F4F8] + 上部 sticky ヘッダー
 *   2) 各セクション(性別/学年/大学/部活/希望診療科) を白い rounded-xl カードで分離
 *   3) 選択肢ボタンは active 時 orange-500 + shadow-md
 * - 認証設計書: 編集後の値は Supabase users テーブルに PATCH で更新する想定。
 */
export default function ProfileEditPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>({
    gender: "",
    grade: "",
    university: "",
    club: "",
    specialty: "",
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("userProfile");
      if (saved) setProfile(JSON.parse(saved));
    } catch {
      // ignore
    }
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem("userProfile", JSON.stringify(profile));
    } catch {
      // ignore
    }
    toast.success("プロフィールを更新しました");
    router.push("/profile");
  };

  const updateField = (field: keyof UserProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  if (!mounted) return <div className="min-h-screen bg-[#F2F4F8]" />;

  return (
    <div className="min-h-screen bg-[#F2F4F8] pb-20">
      <div className="w-full max-w-lg mx-auto">
        {/* ヘッダー */}
        <div className="sticky top-0 z-30 bg-white border-b border-[#B9C2DB] px-4 py-4 flex items-center gap-3 shadow-sm">
          <button
            onClick={() => router.push("/profile")}
            className="text-gray-600 hover:text-[#1E3A8A]"
            aria-label="戻る"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 flex-1 flex items-center gap-2">
            <User size={18} className="text-[#1E3A8A]" />
            プロフィール編集
          </h1>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 bg-[#F2F4F8]0 text-white px-4 py-2 rounded-full text-sm font-bold shadow-sm hover:bg-[#11204C] active:scale-95 transition-all"
          >
            <Save size={16} /> 保存
          </button>
        </div>

        <div className="p-4 space-y-4 animate-fade-in">
          <Section label="性別">
            <div className="grid grid-cols-2 gap-2">
              {profileGenderOptions.map((opt) => (
                <ChipButton
                  key={opt}
                  active={profile.gender === opt}
                  onClick={() => updateField("gender", opt)}
                >
                  {opt}
                </ChipButton>
              ))}
            </div>
          </Section>

          <Section label="学年">
            <div className="grid grid-cols-3 gap-2">
              {profileGradeOptions.map((opt) => (
                <ChipButton
                  key={opt}
                  active={profile.grade === opt}
                  onClick={() => updateField("grade", opt)}
                >
                  {opt}
                </ChipButton>
              ))}
            </div>
          </Section>

          <Section label="大学名">
            <input
              value={profile.university}
              onChange={(e) => updateField("university", e.target.value)}
              placeholder="大学名を入力"
              className="w-full py-3 px-4 rounded-lg border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
            />
          </Section>

          <Section label="部活・サークル（任意）">
            <div className="grid grid-cols-2 gap-2">
              {profileClubOptions.map((opt) => (
                <ChipButton
                  key={opt}
                  active={profile.club === opt}
                  onClick={() => updateField("club", opt)}
                >
                  {opt}
                </ChipButton>
              ))}
            </div>
          </Section>

          <Section label="希望診療科（任意）">
            <div className="grid grid-cols-2 gap-2">
              {profileSpecialtyOptions.map((opt) => (
                <ChipButton
                  key={opt}
                  active={profile.specialty === opt}
                  onClick={() => updateField("specialty", opt)}
                >
                  {opt}
                </ChipButton>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-[#F2F4F8]">
      <label className="text-xs font-bold text-gray-500 mb-3 block">{label}</label>
      {children}
    </div>
  );
}

function ChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-[#F2F4F8]0 text-white shadow-md"
          : "bg-gray-50 text-gray-700 hover:bg-[#F2F4F8] border border-gray-100"
      }`}
    >
      {children}
    </button>
  );
}
