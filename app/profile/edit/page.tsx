"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { profileClubOptions, profileGenderOptions, profileGradeOptions, profileSpecialtyOptions } from "@/lib/data";

type UserProfile = { gender: string; grade: string; university: string; club: string; specialty: string };

export default function ProfileEditPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>({ gender: "", grade: "", university: "", club: "", specialty: "" });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("userProfile");
      if (saved) setProfile(JSON.parse(saved));
    } catch {
      // localStorage not available
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

  if (!mounted) {
    return <div className="min-h-screen bg-[#FFF9FA]" />;
  }

  return (
    <div className="min-h-screen bg-[#FFF9FA] pb-20">
      <div className="w-full max-w-lg mx-auto">
        <div className="sticky top-[110px] z-30 bg-white border-b border-orange-100 px-4 py-4 flex items-center gap-3 shadow-sm">
          <button onClick={() => router.push("/profile")} className="text-gray-600 hover:text-orange-500"><ArrowLeft size={24} /></button>
          <h1 className="text-lg font-bold text-gray-800 flex-1">プロフィール編集</h1>
          <button onClick={handleSave} className="flex items-center gap-1.5 bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-sm hover:bg-orange-600 active:scale-95 transition-all"><Save size={16} /> 保存</button>
        </div>
        <div className="p-4 space-y-6 animate-fade-in">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-orange-50">
            <label className="text-xs font-bold text-gray-500 mb-3 block">性別</label>
            <div className="grid grid-cols-2 gap-2">
              {profileGenderOptions.map((opt) => (
                <button key={opt} onClick={() => updateField("gender", opt)} className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${profile.gender === opt ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-700 hover:bg-orange-50 border border-gray-100"}`}>{opt}</button>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-orange-50">
            <label className="text-xs font-bold text-gray-500 mb-3 block">学年</label>
            <div className="grid grid-cols-3 gap-2">
              {profileGradeOptions.map((opt) => (
                <button key={opt} onClick={() => updateField("grade", opt)} className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${profile.grade === opt ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-700 hover:bg-orange-50 border border-gray-100"}`}>{opt}</button>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-orange-50">
            <label className="text-xs font-bold text-gray-500 mb-3 block">大学名</label>
            <input value={profile.university} onChange={(e) => updateField("university", e.target.value)} placeholder="大学名を入力" className="w-full py-3 px-4 rounded-lg border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-orange-50">
            <label className="text-xs font-bold text-gray-500 mb-3 block">部活・サークル（任意）</label>
            <div className="grid grid-cols-2 gap-2">
              {profileClubOptions.map((opt) => (
                <button key={opt} onClick={() => updateField("club", opt)} className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${profile.club === opt ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-700 hover:bg-orange-50 border border-gray-100"}`}>{opt}</button>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-orange-50">
            <label className="text-xs font-bold text-gray-500 mb-3 block">希望診療科（任意）</label>
            <div className="grid grid-cols-2 gap-2">
              {profileSpecialtyOptions.map((opt) => (
                <button key={opt} onClick={() => updateField("specialty", opt)} className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${profile.specialty === opt ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-700 hover:bg-orange-50 border border-gray-100"}`}>{opt}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
