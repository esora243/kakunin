"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Users, Instagram, Twitter, Mail, ExternalLink } from "lucide-react";
import { studentGroups } from "@/lib/data";

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const group = studentGroups.find((item) => item.id === Number(params.id));

  if (!group) {
    return (
      <div className="min-h-screen bg-white pb-20 flex items-center justify-center">
        <div className="text-center px-6">
          <h2 className="text-xl font-bold text-gray-800 mb-2">団体が見つかりません</h2>
          <p className="text-sm text-gray-500 mb-6">データが未登録か、このページは利用できません。</p>
          <button onClick={() => router.push("/activities")} className="bg-pink-500 text-white font-bold px-6 py-3 rounded-full">課外活動へ戻る</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="w-full max-w-lg mx-auto">
        <div className="sticky top-[110px] z-30 bg-white/90 backdrop-blur-md border-b border-pink-100 px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push("/activities")} className="text-gray-600 hover:text-pink-500"><ArrowLeft size={24} /></button>
          <h1 className="text-base font-bold text-gray-800 flex-1 truncate">団体詳細</h1>
        </div>
        <div className="animate-fade-in">
          <div className="w-full h-64 bg-gray-100 relative">
            {group.image ? <img src={group.image} alt={group.name} className="w-full h-full object-cover" /> : null}
            <div className="absolute top-4 left-4"><span className="bg-pink-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md">{group.category}</span></div>
          </div>
          <div className="px-4 py-6 border-b border-gray-100">
            <h1 className="text-2xl font-bold text-gray-800 mb-3">{group.name}</h1>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4"><Users size={16} className="text-pink-400" /><span>{group.members}名のメンバー</span></div>
            <p className="text-sm text-gray-700 leading-relaxed">{group.description}</p>
          </div>
          <div className="px-4 py-6 bg-gray-50">
            <h3 className="text-base font-bold text-gray-800 mb-4">連絡先・SNS</h3>
            <div className="space-y-3">
              {group.social.instagram && (
                <a href={`https://instagram.com/${group.social.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-pink-200 hover:bg-pink-50/50 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center"><Instagram size={20} className="text-white" /></div>
                    <div><p className="text-xs text-gray-500 font-medium">Instagram</p><p className="text-sm font-bold text-gray-800">{group.social.instagram}</p></div>
                  </div>
                  <ExternalLink size={16} className="text-gray-400" />
                </a>
              )}
              {group.social.twitter && (
                <a href={`https://twitter.com/${group.social.twitter.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-pink-200 hover:bg-pink-50/50 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-400 flex items-center justify-center"><Twitter size={20} className="text-white" /></div>
                    <div><p className="text-xs text-gray-500 font-medium">Twitter (X)</p><p className="text-sm font-bold text-gray-800">{group.social.twitter}</p></div>
                  </div>
                  <ExternalLink size={16} className="text-gray-400" />
                </a>
              )}
              {group.social.mail && (
                <a href={`mailto:${group.social.mail}`} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-pink-200 hover:bg-pink-50/50 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-400 flex items-center justify-center"><Mail size={20} className="text-white" /></div>
                    <div><p className="text-xs text-gray-500 font-medium">Email</p><p className="text-sm font-bold text-gray-800">{group.social.mail}</p></div>
                  </div>
                  <ExternalLink size={16} className="text-gray-400" />
                </a>
              )}
              {!group.social.instagram && !group.social.twitter && !group.social.mail ? (
                <div className="bg-white rounded-xl border border-gray-100 p-4 text-sm text-gray-500">連絡先情報はまだ登録されていません。</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
