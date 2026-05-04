"use client";

import { useState } from "react";
import { MessageCircle, HelpCircle, Users, Globe, Send, Loader2 } from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest"; // Supabase通信用ユーティリティ

export default function ConnectPage() {
  const [activeTab, setActiveTab] = useState<"contact" | "faq" | "ob" | "community">("contact");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "山田 太郎", // プレースホルダーに合わせて初期値設定
    email: "",
    type: "",
    content: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Supabaseの inquiries テーブルにデータを送信（INSERT）
      await supabaseRestFetch({
        path: "inquiries",
        method: "POST",
        body: formData
      });
      
      alert("お問い合わせを受け付けました。担当者より2営業日以内にご連絡いたします。");
      
      // 成功したらフォームをリセット（お名前だけは残す・空にするかはお好みで）
      setFormData({ name: "山田 太郎", email: "", type: "", content: "" });
    } catch (error) {
      console.error("送信エラー:", error);
      alert("送信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white min-h-screen">
      {/* ページヘッダー */}
      <div className="px-6 py-6 border-b border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight mb-6">繋がり</h2>

        {/* タブナビゲーション */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
          <button
            onClick={() => setActiveTab("contact")}
            className={`shrink-0 flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all ${
              activeTab === "contact"
                ? "bg-orange-500 text-white shadow-md"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            <MessageCircle size={18} fill={activeTab === "contact" ? "white" : "none"} /> お問い合わせ
          </button>
          <button
            onClick={() => setActiveTab("faq")}
            className={`shrink-0 flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all ${
              activeTab === "faq"
                ? "bg-orange-500 text-white shadow-md"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            <HelpCircle size={18} /> FAQ
          </button>
          <button
            onClick={() => setActiveTab("ob")}
            className={`shrink-0 flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all ${
              activeTab === "ob"
                ? "bg-orange-500 text-white shadow-md"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Users size={18} /> OBマッチング
          </button>
          <button
            onClick={() => setActiveTab("community")}
            className={`shrink-0 flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all ${
              activeTab === "community"
                ? "bg-orange-500 text-white shadow-md"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Globe size={18} /> コミュニティ
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeTab === "contact" && (
          <div className="max-w-2xl mx-auto animate-fade-in">
            {/* 案内パネル */}
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

            {/* お問い合わせフォーム */}
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 border border-gray-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">お名前 *</label>
                  <input
                    type="text"
                    required
                    placeholder="山田 太郎"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">メールアドレス *</label>
                  <input
                    type="email"
                    required
                    placeholder="example@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">お問い合わせ種別 *</label>
                  <div className="relative">
                    <select
                      required
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-gray-600"
                    >
                      <option value="" disabled>選択してください</option>
                      <option value="service">サービスに関するご質問</option>
                      <option value="bug">不具合の報告</option>
                      <option value="feature">機能追加のご要望</option>
                      <option value="other">その他</option>
                    </select>
                    {/* カスタム矢印 */}
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">お問い合わせ内容 *</label>
                  <textarea
                    required
                    rows={6}
                    placeholder="お問い合わせ内容をご記入ください"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold py-4 rounded-xl transition-colors mt-8"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> 送信中...
                    </>
                  ) : (
                    <>
                      <Send size={18} /> 送信する
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 他のタブのプレースホルダー */}
        {activeTab !== "contact" && (
           <div className="flex flex-col items-center justify-center py-20 text-gray-400">
             <p>現在準備中です</p>
           </div>
        )}
      </div>
    </div>
  );
}