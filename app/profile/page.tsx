"use client";

import { useRouter } from "next/navigation";
import { User, GraduationCap, MapPin, Mail, ChevronRight, LogOut, HelpCircle, Bell, Edit } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { toast } from "sonner";
import { useState, useEffect } from "react";

type UserProfile = { gender: string; grade: string; university: string; club: string; specialty: string };

export default function ProfilePage() {
  const { isLoggedIn, logout, openLoginModal } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
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

  if (!mounted) {
    return <div className="w-full max-w-lg mx-auto p-4 min-h-[60vh]" />;
  }

  if (!isLoggedIn) {
    return (
      <div className="w-full max-w-lg mx-auto p-4 flex flex-col items-center justify-center min-h-[60vh]">
        <User size={48} className="text-orange-200 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">マイページ</h2>
        <p className="text-sm text-gray-500 mb-6 text-center">プロフィールや設定を確認するにはログインが必要です</p>
        <button onClick={openLoginModal} className="bg-orange-500 text-white font-bold py-3 px-8 rounded-full shadow-sm hover:bg-orange-600 transition-colors">LINEでログインする</button>
      </div>
    );
  }

  const handleLogout = () => { logout(); toast("ログアウトしました"); router.push("/"); };

  return (
    <div className="w-full max-w-lg mx-auto bg-[#FFF9FA] min-h-screen animate-slide-in-bottom pb-20">
      <div className="bg-white px-6 py-8 border-b border-orange-100 shadow-sm relative">
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center text-white font-bold text-3xl shadow-md border-4 border-white mb-3">
            {profile?.university?.[0] || "医"}
          </div>
          <h2 className="text-xl font-bold text-gray-800">{profile ? `${profile.university} ${profile.grade}` : "医学生"}</h2>
          <p className="text-xs text-gray-500 mt-1 font-medium bg-orange-50 px-3 py-1 rounded-full border border-orange-100">ID: HMD-123456</p>
          {!profile && (
            <button onClick={() => router.push("/register")} className="mt-4 flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-sm hover:bg-orange-600 active:scale-95 transition-all">
              <Edit size={14} /> プロフィールを登録する
            </button>
          )}
        </div>
        {profile && (
          <button onClick={() => router.push("/profile/edit")} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-orange-500 transition-colors bg-gray-50 rounded-full"><Edit size={20} /></button>
        )}
      </div>

      <div className="p-4 space-y-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-sm border border-orange-50 overflow-hidden">
          <div className="bg-orange-50/50 px-4 py-3 border-b border-orange-100">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5"><User size={16} className="text-orange-500" /> 基本情報</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {profile && (
              <>
                <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center"><GraduationCap size={16} /></div>
                    <div><p className="text-[10px] text-gray-400 font-bold mb-0.5">大学・学年</p><p className="text-sm text-gray-800 font-medium">{profile.university} {profile.grade}</p></div>
                  </div>
                  <ChevronRight size={16} className="text-gray-300" />
                </div>
                <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center"><User size={16} /></div>
                    <div><p className="text-[10px] text-gray-400 font-bold mb-0.5">性別</p><p className="text-sm text-gray-800 font-medium">{profile.gender || "未設定"}</p></div>
                  </div>
                  <ChevronRight size={16} className="text-gray-300" />
                </div>
                {profile.club && (
                  <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-50 text-green-500 flex items-center justify-center"><MapPin size={16} /></div>
                      <div><p className="text-[10px] text-gray-400 font-bold mb-0.5">部活・サークル</p><p className="text-sm text-gray-800 font-medium">{profile.club}</p></div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300" />
                  </div>
                )}
                {profile.specialty && (
                  <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center"><Mail size={16} /></div>
                      <div><p className="text-[10px] text-gray-400 font-bold mb-0.5">希望診療科</p><p className="text-sm text-gray-800 font-medium">{profile.specialty}</p></div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-orange-50 overflow-hidden divide-y divide-gray-50">
          <button className="w-full flex items-center justify-between p-4 hover:bg-orange-50/50 transition-colors group">
            <div className="flex items-center gap-3"><Bell size={18} className="text-gray-400 group-hover:text-orange-500 transition-colors" /><span className="text-sm font-bold text-gray-700">通知設定</span></div>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
          <button className="w-full flex items-center justify-between p-4 hover:bg-orange-50/50 transition-colors group">
            <div className="flex items-center gap-3"><HelpCircle size={18} className="text-gray-400 group-hover:text-orange-500 transition-colors" /><span className="text-sm font-bold text-gray-700">よくある質問 / お問い合わせ</span></div>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        </div>
        <button onClick={handleLogout} className="w-full mt-6 flex items-center justify-center gap-2 py-4 bg-white rounded-2xl text-red-500 font-bold shadow-sm border border-red-50 hover:bg-red-50 transition-colors">
          <LogOut size={18} /><span>ログアウト</span>
        </button>
      </div>
    </div>
  );
}
