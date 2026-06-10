"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  GraduationCap,
  MapPin,
  ChevronRight,
  LogOut,
  HelpCircle,
  Bell,
  Edit,
  Briefcase,
  Bookmark,
  Building2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthContext";

type UserProfile = {
  gender: string;
  grade: string;
  university: string;
  club: string;
  specialty: string;
};

/**
 * マイページ(プロフィール)
 * - Hugmeid mock の Profile.tsx 準拠デザイン:
 *   1) 背景: bg-[#FFF9FA]
 *   2) 上部: 大きな円形 グラデーションアバター(orange-300→orange-500)
 *   3) 基本情報カード: orange-50/50 ヘッダー + 4色のサブアイコン
 *   4) メニュー: 通知設定 / FAQ / 求人(独立メニュー) / 保存済み
 *   5) ログアウトボタン
 * - 認証は LINE LIFF / Supabase JWT を想定。
 * - 求人へのアクセス導線をマイページ配下に置く(Hugmeid mock のナビ整理に合わせ)。
 */
export default function ProfilePage() {
  const { isLoggedIn, openLoginModal, logout } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("userProfile");
      if (saved) setProfile(JSON.parse(saved));
    } catch {
      // ignore
    }
  }, []);

  if (!isLoggedIn) {
    return (
      <div className="w-full max-w-lg mx-auto p-4 flex flex-col items-center justify-center min-h-[60vh]">
        <User size={48} className="text-orange-200 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">マイページ</h2>
        <p className="text-sm text-gray-500 mb-6 text-center">
          プロフィールや設定を確認するにはログインが必要です
        </p>
        <button
          onClick={openLoginModal}
          className="bg-orange-500 text-white font-bold py-3 px-8 rounded-full shadow-sm hover:bg-orange-600 transition-colors"
        >
          LINEでログインする
        </button>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    toast("ログアウトしました");
    router.push("/");
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-[#FFF9FA] min-h-screen pb-20 animate-fade-in">
      {/* ============================================================
          ヘッダー(プロフィールセクション)
         ============================================================ */}
      <div className="bg-white px-6 py-8 border-b border-orange-100 shadow-sm relative">
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center text-white font-bold text-3xl shadow-md border-4 border-white mb-3">
            {profile?.university?.[0] || "医"}
          </div>
          <h2 className="text-xl font-bold text-gray-800">
            {profile ? `${profile.university} ${profile.grade}` : "医学生"}
          </h2>
          <p className="text-xs text-gray-500 mt-1 font-medium bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
            ID: HMD-123456
          </p>
          {!profile && (
            <button
              onClick={() => router.push("/register")}
              className="mt-4 flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-sm hover:bg-orange-600 active:scale-95 transition-all"
            >
              <Edit size={14} />
              プロフィールを登録する
            </button>
          )}
        </div>

        {profile && (
          <button
            onClick={() => router.push("/profile/edit")}
            aria-label="プロフィール編集"
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-orange-500 transition-colors bg-gray-50 rounded-full"
          >
            <Edit size={20} />
          </button>
        )}
      </div>

      {/* ============================================================
          基本情報・メニュー
         ============================================================ */}
      <div className="p-4 space-y-4 -mt-4">
        {profile && (
          <div className="bg-white rounded-2xl shadow-sm border border-orange-50 overflow-hidden">
            <div className="bg-orange-50/50 px-4 py-3 border-b border-orange-100">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                <User size={16} className="text-orange-500" /> 基本情報
              </h3>
            </div>
            <div className="divide-y divide-gray-50">
              <ProfileRow
                icon={<GraduationCap size={16} />}
                iconBg="bg-blue-50 text-blue-500"
                label="大学・学年"
                value={`${profile.university} ${profile.grade}`}
              />
              <ProfileRow
                icon={<User size={16} />}
                iconBg="bg-purple-50 text-purple-500"
                label="性別"
                value={profile.gender || "未設定"}
              />
              {profile.club && (
                <ProfileRow
                  icon={<MapPin size={16} />}
                  iconBg="bg-green-50 text-green-500"
                  label="部活・サークル"
                  value={profile.club}
                />
              )}
              {profile.specialty && (
                <ProfileRow
                  icon={<Mail size={16} />}
                  iconBg="bg-red-50 text-red-500"
                  label="希望診療科"
                  value={profile.specialty}
                />
              )}
            </div>
          </div>
        )}

        {/* 求人/保存済み への導線(Hugmeid mock ではナビから外しマイページ配下へ) */}
        <div className="bg-white rounded-2xl shadow-sm border border-orange-50 overflow-hidden divide-y divide-gray-50">
          <Link
            href="/jobs"
            className="w-full flex items-center justify-between p-4 hover:bg-orange-50/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Briefcase
                size={18}
                className="text-gray-400 group-hover:text-orange-500 transition-colors"
              />
              <span className="text-sm font-bold text-gray-700">求人を探す</span>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </Link>
          <Link
            href="/saved"
            className="w-full flex items-center justify-between p-4 hover:bg-orange-50/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Bookmark
                size={18}
                className="text-gray-400 group-hover:text-orange-500 transition-colors"
              />
              <span className="text-sm font-bold text-gray-700">保存済み</span>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </Link>
          <Link
            href="/campaign"
            className="w-full flex items-center justify-between p-4 hover:bg-orange-50/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Building2
                size={18}
                className="text-gray-400 group-hover:text-orange-500 transition-colors"
              />
              <span className="text-sm font-bold text-gray-700">キャンペーン・特典</span>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </Link>
        </div>

        {/* メニュー */}
        <div className="bg-white rounded-2xl shadow-sm border border-orange-50 overflow-hidden divide-y divide-gray-50">
          <button className="w-full flex items-center justify-between p-4 hover:bg-orange-50/50 transition-colors group">
            <div className="flex items-center gap-3">
              <Bell
                size={18}
                className="text-gray-400 group-hover:text-orange-500 transition-colors"
              />
              <span className="text-sm font-bold text-gray-700">通知設定</span>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </button>

          <Link
            href="/connect"
            className="w-full flex items-center justify-between p-4 hover:bg-orange-50/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <HelpCircle
                size={18}
                className="text-gray-400 group-hover:text-orange-500 transition-colors"
              />
              <span className="text-sm font-bold text-gray-700">
                よくある質問 / お問い合わせ
              </span>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </Link>
        </div>

        <button
          onClick={handleLogout}
          className="w-full mt-6 flex items-center justify-center gap-2 py-4 bg-white rounded-2xl text-red-500 font-bold shadow-sm border border-red-50 hover:bg-red-50 transition-colors"
        >
          <LogOut size={18} />
          <span>ログアウト</span>
        </button>
      </div>
    </div>
  );
}

function ProfileRow({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <div>
          <p className="text-[10px] text-gray-400 font-bold mb-0.5">{label}</p>
          <p className="text-sm text-gray-800 font-medium">{value}</p>
        </div>
      </div>
      <ChevronRight size={16} className="text-gray-300" />
    </div>
  );
}
