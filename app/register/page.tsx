"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, User, GraduationCap, Building2, Dumbbell, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { profileClubOptions, profileGenderOptions, profileGradeOptions, profileSpecialtyOptions } from "@/lib/data";

type UserProfile = { gender: string; grade: string; university: string; club: string; specialty: string };

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<UserProfile>({ gender: "", grade: "", university: "", club: "", specialty: "" });

  const updateProfile = (field: keyof UserProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1);
    } else {
      try {
        localStorage.setItem("userProfile", JSON.stringify(profile));
      } catch {
        // ignore
      }
      toast.success("登録が完了しました！");
      router.push("/profile");
    }
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
    { title: "性別を選択してください", icon: User, options: profileGenderOptions, field: "gender" as keyof UserProfile },
    { title: "学年を選択してください", icon: GraduationCap, options: profileGradeOptions, field: "grade" as keyof UserProfile },
    { title: "大学名を入力してください", icon: Building2, field: "university" as keyof UserProfile, isFreeInput: true, placeholder: "大学名を入力" },
    { title: "所属している部活・サークルを教えてください（任意）", icon: Dumbbell, options: profileClubOptions, field: "club" as keyof UserProfile, optional: true },
    { title: "希望診療科を選択してください（任意）", icon: Stethoscope, options: profileSpecialtyOptions, field: "specialty" as keyof UserProfile, optional: true },
  ];

  const currentStep = steps[step - 1];
  const Icon = currentStep.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white flex flex-col">
      <div className="w-full max-w-lg mx-auto p-6 flex-1 flex flex-col animate-fade-in">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">STEP {step} / 5</span>
            <span className="text-xs font-semibold text-pink-500">{Math.round((step / 5) * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-pink-400 to-pink-500 transition-all duration-500 ease-out rounded-full" style={{ width: `${(step / 5) * 100}%` }} />
          </div>
        </div>
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-pink-400 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg"><Icon className="text-white" size={32} strokeWidth={2} /></div>
          <h2 className="text-xl font-bold text-gray-800 leading-tight mb-2">{currentStep.title}</h2>
          {currentStep.optional ? <p className="text-xs text-pink-500 mt-2">※ スキップ可能</p> : null}
        </div>

        <div className="flex-1 space-y-3 mb-8">
          {currentStep.isFreeInput ? (
            <input
              value={profile[currentStep.field]}
              onChange={(e) => updateProfile(currentStep.field, e.target.value)}
              placeholder={currentStep.placeholder}
              className="w-full p-4 rounded-xl border-2 border-gray-200 bg-white text-gray-700 focus:border-pink-500 focus:outline-none"
            />
          ) : (
            currentStep.options?.map((option) => (
              <button key={option} onClick={() => updateProfile(currentStep.field, option)} className={`w-full p-4 rounded-xl border-2 transition-all text-left font-medium ${profile[currentStep.field] === option ? "border-pink-500 bg-pink-50 text-pink-700 shadow-md" : "border-gray-200 bg-white text-gray-700 hover:border-pink-200 hover:bg-pink-50/50"}`}>
                <div className="flex items-center justify-between">
                  <span>{option}</span>
                  {profile[currentStep.field] === option && (
                    <div className="w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
        <div className="flex gap-3">
          {step > 1 && <button onClick={() => setStep(step - 1)} className="flex-1 py-3.5 rounded-xl border-2 border-gray-200 bg-white text-gray-700 font-bold hover:bg-gray-50 transition-colors">戻る</button>}
          <button onClick={handleNext} disabled={!canProceed()} className={`flex-1 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${canProceed() ? "bg-gradient-to-r from-pink-400 to-pink-500 text-white shadow-md hover:shadow-lg active:scale-95" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}>
            {step === 5 ? "登録完了" : "次へ"}{step < 5 && <ChevronRight size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
