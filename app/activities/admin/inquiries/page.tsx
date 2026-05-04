"use client";

import { useEffect, useState } from "react";
import { Mail, Search, CheckCircle, Clock, ChevronDown } from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";

export default function AdminInquiriesPage() {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("unread");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetchInquiries();
  }, []);

  async function fetchInquiries() {
    setLoading(true);
    try {
      // 最新のものが上に来るように取得 (エラー回避のため as any を追加)
      const data = await supabaseRestFetch<any[]>({ 
        path: "inquiries?select=*&order=created_at.desc" 
      } as any);
      setInquiries(data || []);
    } catch (error) {
      console.error("取得エラー:", error);
    } finally {
      setLoading(false);
    }
  }

  // ステータスを「既読」に変更する関数
  async function markAsRead(id: number, currentStatus: string) {
    if (currentStatus === 'read') return;
    try {
      // エラー回避のため as any を追加
      await supabaseRestFetch({
        path: `inquiries?id=eq.${id}`,
        method: "PATCH",
        body: { status: 'read' }
      } as any);
      // 画面上のデータも更新
      setInquiries(inquiries.map(iq => iq.id === id ? { ...iq, status: 'read' } : iq));
    } catch (error) {
      console.error("更新エラー:", error);
    }
  }

  const displayInquiries = inquiries.filter(iq => filter === "all" || iq.status === filter);

  return (
    <div className="w-full max-w-4xl mx-auto bg-gray-50 min-h-screen p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Mail className="text-orange-500" /> お問い合わせ管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">ユーザーからのメッセージを確認・管理します</p>
        </div>
        
        <div className="flex bg-white rounded-lg p-1 border border-gray-200">
          <button 
            onClick={() => setFilter("unread")}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${filter === "unread" ? "bg-orange-50 text-orange-600" : "text-gray-500 hover:bg-gray-50"}`}
          >
            未読のみ
          </button>
          <button 
            onClick={() => setFilter("all")}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${filter === "all" ? "bg-orange-50 text-orange-600" : "text-gray-500 hover:bg-gray-50"}`}
          >
            すべて表示
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 font-bold">読み込み中...</div>
      ) : displayInquiries.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center border border-dashed border-gray-300 text-gray-500">
          該当するお問い合わせはありません
        </div>
      ) : (
        <div className="space-y-4">
          {displayInquiries.map((iq) => (
            <div key={iq.id} className={`bg-white rounded-xl border overflow-hidden transition-all ${iq.status === 'unread' ? 'border-l-4 border-l-orange-500 border-gray-200' : 'border-gray-200 opacity-80'}`}>
              {/* ヘッダー部分（クリックで展開） */}
              <button 
                onClick={() => {
                  setExpandedId(expandedId === iq.id ? null : iq.id);
                  if (iq.status === 'unread') markAsRead(iq.id, iq.status);
                }}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 text-left"
              >
                <div className="flex items-center gap-4">
                  {iq.status === 'unread' ? <Clock className="text-orange-500" size={20} /> : <CheckCircle className="text-gray-400" size={20} />}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{iq.type}</span>
                      <span className="text-xs text-gray-400">{new Date(iq.created_at).toLocaleString()}</span>
                    </div>
                    <div className="font-bold text-gray-800">{iq.name} <span className="text-sm font-normal text-gray-500 ml-2">{iq.email}</span></div>
                  </div>
                </div>
                <ChevronDown size={20} className={`text-gray-400 transition-transform ${expandedId === iq.id ? 'rotate-180' : ''}`} />
              </button>

              {/* 展開される本文部分 */}
              {expandedId === iq.id && (
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {iq.content}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}