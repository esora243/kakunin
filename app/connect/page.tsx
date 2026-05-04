"use client";

import { useState, useEffect, useMemo } from "react";
import { MessageCircle, HelpCircle, Users, Globe, Send, Loader2, ChevronDown } from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";

const FAQ_CATEGORIES = ["すべて", "基本情報", "求人", "アカウント", "通知", "課外活動"];

export default function ConnectPage() {
  const [activeTab, setActiveTab] = useState<"contact" | "faq" | "ob" | "community">("faq"); // テスト確認のため初期タブをfaqに
  
  // --- お問い合わせ用ステート ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "山田 太郎",
    email: "",
    type: "",
    content: ""
  });

  // --- FAQ用ステート ---
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const [activeFaqCategory, setActiveFaqCategory] = useState("すべて");
  const [expandedFaqId, setExpandedFaqId] = useState<number | null>(null);

  // FAQデータの取得
  useEffect(() => {
    let cancelled = false;
    async function fetchFaqs() {
      if (activeTab !== "faq") return;
      setLoadingFaqs(true);
      try {
        const data = await supabaseRestFetch<any[]>({ path: "faqs?select=*" });
        if (!cancelled) setFaqs(data || []);
      } catch (error) {
        console.error("FAQ取得エラー:", error);
      } finally {
        if (!cancelled) setLoadingFaqs(false);
      }
    }
    fetchFaqs();
    return () => { cancelled = true; };
  }, [activeTab]);

  const filteredFaqs = useMemo(() => {
    return faqs.filter(faq => 
      activeFaqCategory === "すべて" || faq.category === activeFaqCategory
    );
  }, [faqs, activeFaqCategory]);

  // お問い合わせ送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await supabaseRestFetch({ path: "inquiries", method: "POST", body: formData } as any);
      alert("お問い合わせを受け付けました。担当者より2営業日以内にご連絡いたします。");
      setFormData({ name: "山田 太郎", email: "", type: "", content: "" });
    } catch (error) {
      console.error("送信エラー:", error);
      alert("送信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white min-h-screen font-sans">
      {/* ページヘッダー */}
      <div className="px-6 py-6 border-b border-gray-100 sticky top-0 bg-white z-20">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight mb-6">繋がり</h2>

        {/* タブナビゲーション */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
          <button onClick={() => setActiveTab("contact")} className={`shrink-0 flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all ${activeTab === "contact" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
            <MessageCircle size={18} fill={activeTab === "contact" ? "white" : "none"} /> お問い合わせ
          </button>
          <button onClick={() => setActiveTab("faq")} className={`shrink-0 flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all ${activeTab === "faq" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
            <HelpCircle size={18} fill={activeTab === "faq" ? "white" : "none"} /> FAQ
          </button>
          <button onClick={() => setActiveTab("ob")} className={`shrink-0 flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all ${activeTab === "ob" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
            <Users size={18} /> OBマッチング
          </button>
          <button onClick={() => setActiveTab("community")} className={`shrink-0 flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all ${activeTab === "community" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
            <Globe size={18} /> コミュニティ
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 bg-[#fffcfc]"> {/* わずかに温かみのある背景色 */}
        
        {/* ========================================================= */}
        {/* FAQタブ (画像デザイン完全準拠) */}
        {/* ========================================================= */}
        {activeTab === "faq" && (
          <div className="max-w-2xl mx-auto animate-fade-in">
            {/* 案内パネル (ブルー系) */}
            <div className="bg-blue-50/70 rounded-2xl p-6 border border-blue-100 mb-6 flex gap-4 items-start">
              <div className="bg-[#3b82f6] text-white p-3 rounded-xl shrink-0 shadow-sm">
                <HelpCircle size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-1">よくある質問</h3>
                <p className="text-[11px] font-bold text-gray-400 mb-3 uppercase tracking-wider">FAQ</p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  よくあるご質問をまとめました。解決しない場合はお問い合わせください。
                </p>
              </div>
            </div>

            {/* カテゴリフィルタータグ */}
            <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar pb-2">
              {FAQ_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveFaqCategory(cat)}
                  className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-bold transition-all border ${
                    activeFaqCategory === cat
                      ? "bg-[#2563eb] text-white border-[#2563eb] shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* FAQリスト（アコーディオン） */}
            {loadingFaqs ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={40} /></div>
            ) : filteredFaqs.length === 0 ? (
              <div className="text-center py-20 text-gray-400 font-bold bg-white rounded-2xl border border-gray-100">該当する質問がありません</div>
            ) : (
              <div className="space-y-4">
                {filteredFaqs.map((faq) => (
                  <div key={faq.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all">
                    <button
                      onClick={() => setExpandedFaqId(expandedFaqId === faq.id ? null : faq.id)}
                      className="w-full px-5 py-5 text-left flex justify-between items-start hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="flex-1 pr-4">
                        <span className="inline-block bg-blue-50 text-blue-600 px-2.5 py-1 rounded text-[10px] font-bold mb-3">
                          {faq.category}
                        </span>
                        <div className="flex items-start gap-2">
                          <span className="text-orange-500 font-bold text-lg leading-none mt-0.5">Q.</span>
                          <h4 className="font-bold text-gray-800 text-sm sm:text-base leading-snug">
                            {faq.question}
                          </h4>
                        </div>
                      </div>
                      <div className="shrink-0 pt-2">
                        <ChevronDown 
                          size={20} 
                          className={`text-gray-400 transition-transform duration-300 ${expandedFaqId === faq.id ? 'rotate-180' : ''}`} 
                        />
                      </div>
                    </button>
                    
                    {/* 展開される回答部分 */}
                    <div 
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        expandedFaqId === faq.id ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="px-5 pb-6 pt-2 border-t border-gray-50">
                        <div className="flex items-start gap-2 bg-gray-50 p-4 rounded-xl">
                          <span className="text-blue-500 font-bold text-lg leading-none mt-0.5">A.</span>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {faq.answer}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* お問い合わせタブ (既存コードの維持) */}
        {/* ========================================================= */}
        {activeTab === "contact" && (
          <div className="max-w-2xl mx-auto animate-fade-in">
             {/* ... (前回実装したお問い合わせフォームのコードそのまま) ... */}
            <div className="bg-orange-50/50 rounded-2xl p-6 border border-orange-100 mb-8 flex gap-4 items-start">
              <div className="bg-orange-500 text-white p-3 rounded-xl shrink-0">
                <MessageCircle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-1">お問い合わせ</h3>
                <p className="text-sm text-gray-500 mb-3">お気軽にご連絡ください</p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  ご質問、ご要望、不具合報告など、どんなことでもお気軽にお問い合わせください。担当者より2営業日以内にご連絡いたします。
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">お名前 *</label>
                  <input type="text" required placeholder="山田 太郎" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">メールアドレス *</label>
                  <input type="email" required placeholder="example@email.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">お問い合わせ種別 *</label>
                  <div className="relative">
                    <select required value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-gray-600">
                      <option value="" disabled>選択してください</option>
                      <option value="service">サービスに関するご質問</option>
                      <option value="bug">不具合の報告</option>
                      <option value="feature">機能追加のご要望</option>
                      <option value="other">その他</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                      <ChevronDown size={16} />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">お問い合わせ内容 *</label>
                  <textarea required rows={6} placeholder="お問い合わせ内容をご記入ください" value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all resize-none" />
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold py-4 rounded-xl transition-colors mt-8">
                  {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> 送信中...</> : <><Send size={18} /> 送信する</>}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 準備中タブプレースホルダー */}
        {(activeTab === "ob" || activeTab === "community") && (
           <div className="flex flex-col items-center justify-center py-20 text-gray-400">
             <p>現在準備中です</p>
           </div>
        )}
      </div>
    </div>
  );
}