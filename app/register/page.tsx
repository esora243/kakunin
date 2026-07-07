"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  User,
  GraduationCap,
  Building2,
  Dumbbell,
  Stethoscope,
} from "lucide-react";
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
 * 登録ページ (LIFF想定 5ステップ)
 * - 要件定義書 v1.2: 性別 / 学年 / 大学名 / 部活 / 希望診療科 (Phase 1)
 * - Hugmeid mock のオレンジグラデーション背景 + 円形グラデーション
 *   アイコンを採用。プログレスバーは orange-400→orange-500 grad。
 * - LINE UID は LIFF SDK 側で取得し、保存時に Supabase に upsert する想定
 *   (技術スタック / 認証設計書参照)。
 */
export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<UserProfile>({
    gender: "",
    grade: "",
    university: "",
    club: "",
    specialty: "",
  });

  const updateProfile = (field: keyof UserProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1);
      return;
    }

    try {
      localStorage.setItem("userProfile", JSON.stringify(profile));
    } catch {
      // ignore
    }

    // TODO: Supabase users テーブルへ upsert(LIFF UID 付与)
    toast.success("登録が完了しました！");
    router.push("/profile");
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return profile.gender !== "";
      case 2:
        return profile.grade !== "";
      case 3:
        return profile.university.trim() !== "";
      default:
        return true;
    }
  };

  const steps = [
    {
      title: "性別を選択してください",
      icon: User,
      options: profileGenderOptions,
      field: "gender" as keyof UserProfile,
    },
    {
      title: "学年を選択してください",
      icon: GraduationCap,
      options: profileGradeOptions,
      field: "grade" as keyof UserProfile,
    },
    {
      title: "大学名を入力してください",
      icon: Building2,
      field: "university" as keyof UserProfile,
      isFreeInput: true,
      placeholder: "大学名を入力",
    },
    {
      title: "所属している部活・サークルを教えてください（任意）",
      icon: Dumbbell,
      options: profileClubOptions,
      field: "club" as keyof UserProfile,
      optional: true,
    },
    {
      title: "希望診療科を選択してください（任意）",
      icon: Stethoscope,
      options: profileSpecialtyOptions,
      field: "specialty" as keyof UserProfile,
      optional: true,
    },
  ];

  const currentStep = steps[step - 1];
  const Icon = currentStep.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F2F4F8] to-white flex flex-col">
      <div className="w-full max-w-lg mx-auto p-6 flex-1 flex flex-col animate-fade-in">
        {/* プログレスバー */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">STEP {step} / 5</span>
            <span className="text-xs font-semibold text-[#1E3A8A]">
              {Math.round((step / 5) * 100)}%
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#1E3A8A] to-[#11204C] transition-all duration-500 ease-out rounded-full"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* タイトル */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-[#1E3A8A] to-[#11204C] rounded-2xl flex items-center justify-center shadow-lg">
            <Icon className="text-white" size={32} strokeWidth={2} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 leading-tight mb-2">
            {currentStep.title}
          </h2>
          {currentStep.optional ? (
            <p className="text-xs text-[#1E3A8A] mt-2">※ スキップ可能</p>
          ) : null}
        </div>

        {/* 入力 */}
        <div className="flex-1 space-y-3 mb-8">
          {currentStep.isFreeInput ? (
            <input
              value={profile[currentStep.field]}
              onChange={(e) => updateProfile(currentStep.field, e.target.value)}
              placeholder={currentStep.placeholder}
              className="w-full p-4 rounded-xl border-2 border-gray-200 bg-white text-gray-700 focus:border-[#F2F4F8]0 focus:outline-none"
            />
          ) : (
            currentStep.options?.map((option) => (
              <button
                key={option}
                onClick={() => updateProfile(currentStep.field, option)}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left font-medium ${
                  profile[currentStep.field] === option
                    ? "border-[#F2F4F8]0 bg-[#F2F4F8] text-[#11204C] shadow-md"
                    : "border-gray-200 bg-white text-gray-700 hover:border-[#B9C2DB] hover:bg-[#F2F4F8]/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{option}</span>
                  {profile[currentStep.field] === option && (
                    <div className="w-6 h-6 rounded-full bg-[#F2F4F8]0 flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* ナビゲーション */}
        <div className="flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 py-3.5 rounded-xl border-2 border-gray-200 bg-white text-gray-700 font-bold hover:bg-gray-50 transition-colors"
            >
              戻る
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className={`flex-1 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              canProceed()
                ? "bg-gradient-to-r from-[#1E3A8A] to-[#11204C] text-white shadow-md hover:shadow-lg active:scale-95"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            {step === 5 ? "登録完了" : "次へ"}
            {step < 5 && <ChevronRight size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
