"use client";

import { useState, useEffect, useMemo } from "react";
import {
  MessageCircle,
  HelpCircle,
  Users,
  Globe,
  Send,
  Loader2,
  ChevronDown,
  GraduationCap,
  Briefcase,
  MapPin,
  Mail,
  ExternalLink,
} from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";
import { FloatingBanner } from "@/components/FloatingBanner";

const FAQ_CATEGORIES = ["すべて", "基本情報", "求人", "アカウント", "通知", "課外活動"];

/**
 * 繋がりページ
 * - Hugmeid mock の Connect.tsx に準拠した sticky ヘッダー / orange タブ /
 *   FloatingBanner / FAQ アコーディオン / お問い合わせフォームを反映。
 * - kakunin の Supabase 連携(faqs / inquiries POST), 4タブ構成 を保持。
 * - 要件定義書: お問い合わせ/FAQ は Phase 1、OBマッチング/コミュニティは Phase 2。
 */
export default function ConnectPage() {
  const [activeTab, setActiveTab] = useState<"contact" | "faq" | "ob" | "community">(
    "contact",
  );

  // お問い合わせ
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    type: "",
    content: "",
  });

  // FAQ
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const [activeFaqCategory, setActiveFaqCategory] = useState("すべて");
  const [expandedFaqId, setExpandedFaqId] = useState<number | null>(null);

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
    void fetchFaqs();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const filteredFaqs = useMemo(
    () =>
      faqs.filter((faq) => activeFaqCategory === "すべて" || faq.category === activeFaqCategory),
    [faqs, activeFaqCategory],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await supabaseRestFetch({
        path: "inquiries",
        method: "POST",
        body: formData,
      } as any);
      alert("お問い合わせを受け付けました。担当者より2営業日以内にご連絡いたします。");
      setFormData({ name: "", email: "", type: "", content: "" });
    } catch (error) {
      console.error("送信エラー:", error);
      alert("送信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto pb-8 animate-slide-in-right">
      {/* ============================================================
          sticky ヘッダー (タブ)
         ============================================================ */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-orange-100 px-4 py-4 shadow-sm">
        <h2 className="text-xl font-bold text-gray-800 mb-4">繋がり</h2>

        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          <TabPill
            active={activeTab === "contact"}
            onClick={() => setActiveTab("contact")}
            label="💬 お問い合わせ"
          />
          <TabPill
            active={activeTab === "faq"}
            onClick={() => setActiveTab("faq")}
            label="❓ FAQ"
          />
          <TabPill
            active={activeTab === "ob"}
            onClick={() => setActiveTab("ob")}
            label="👥 OBマッチング"
          />
          <TabPill
            active={activeTab === "community"}
            onClick={() => setActiveTab("community")}
            label="🌐 コミュニティ"
          />
        </div>
      </div>

      {/* ============================================================
          FloatingBanner (繋がり用)
         ============================================================ */}
      <div className="pt-3">
        <FloatingBanner
          campaignId="4"
          title="OB訪問・キャリア相談会のお知らせ"
          imageUrl="https://images.unsplash.com/photo-1560111828-e16fc96d9a5e?auto=format&fit=crop&q=80&w=1080"
          sponsorName="医学生キャリア支援センター"
        />
      </div>

      {/* ============================================================
          コンテンツ
         ============================================================ */}
      <div className="px-4 pt-1">
        {/* === お問い合わせ === */}
        {activeTab === "contact" && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-gradient-to-br from-orange-50 to-orange-50 rounded-2xl p-6 border border-orange-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center shadow-md">
                  <MessageCircle className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">お問い合わせ</h3>
                  <p className="text-xs text-gray-500">お気軽にご連絡ください</p>
                </div>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                ご質問、ご要望、不具合報告など、どんなことでもお気軽にお問い合わせください。
                担当者より2営業日以内にご連絡いたします。
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-2xl shadow-sm border border-orange-50 p-6 space-y-5"
            >
              <div>
                <label className="text-xs font-bold text-gray-600 mb-2 block">お名前 *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="山田 太郎"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-2 block">
                  メールアドレス *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="example@email.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-2 block">
                  お問い合わせ種別 *
                </label>
                <div className="relative">
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm text-gray-700"
                  >
                    <option value="" disabled>
                      選択してください
                    </option>
                    <option value="contact">連絡先が欲しい</option>
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
                <label className="text-xs font-bold text-gray-600 mb-2 block">
                  お問い合わせ内容 *
                </label>
                <textarea
                  required
                  rows={6}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="お問い合わせ内容をご記入ください"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-orange-400 to-orange-500 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    送信中...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    送信する
                  </>
                )}
              </button>
            </form>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs text-gray-700">
                <span className="font-bold">💡 ヒント：</span>
                「〜〜の連絡先が欲しい」などのご要望もお気軽にお送りください。
              </p>
            </div>
          </div>
        )}

        {/* === FAQ === */}
        {activeTab === "faq" && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center shadow-md">
                  <HelpCircle className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">よくある質問</h3>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    FAQ
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-600">
                よくあるご質問をまとめました。解決しない場合はお問い合わせください。
              </p>
            </div>

            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
              {FAQ_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveFaqCategory(cat)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                    activeFaqCategory === cat
                      ? "bg-blue-500 text-white border-blue-500 shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {loadingFaqs ? (
              <div className="flex justify-center py-20">
                <Loader2 className="animate-spin text-orange-500" size={40} />
              </div>
            ) : filteredFaqs.length === 0 ? (
              <div className="text-center py-20 text-gray-400 font-bold bg-white rounded-2xl border border-orange-50">
                該当する質問がありません
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFaqs.map((faq) => (
                  <div
                    key={faq.id}
                    className="bg-white rounded-2xl border border-orange-50 shadow-sm overflow-hidden transition-all"
                  >
                    <button
                      onClick={() =>
                        setExpandedFaqId(expandedFaqId === faq.id ? null : faq.id)
                      }
                      className="w-full px-5 py-4 text-left flex justify-between items-start hover:bg-orange-50/50 transition-colors"
                    >
                      <div className="flex-1 pr-4">
                        <span className="inline-block bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded text-[10px] font-bold mb-2">
                          {faq.category}
                        </span>
                        <div className="flex items-start gap-2">
                          <span className="text-orange-500 font-bold text-base leading-none mt-0.5">
                            Q.
                          </span>
                          <h4 className="font-bold text-gray-800 text-sm leading-snug">
                            {faq.question}
                          </h4>
                        </div>
                      </div>
                      <div className="shrink-0 pt-2">
                        <ChevronDown
                          size={20}
                          className={`text-gray-400 transition-transform duration-300 ${
                            expandedFaqId === faq.id ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </button>

                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        expandedFaqId === faq.id
                          ? "max-h-96 opacity-100"
                          : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="px-5 pb-5 pt-2 border-t border-gray-50">
                        <div className="flex items-start gap-2 bg-orange-50/50 p-3 rounded-lg">
                          <span className="text-blue-500 font-bold text-base leading-none mt-0.5">
                            A.
                          </span>
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

            <div className="bg-white rounded-xl p-5 text-center mt-2 border border-orange-50">
              <p className="text-xs text-gray-600 mb-3">解決しない場合は</p>
              <button
                onClick={() => setActiveTab("contact")}
                className="bg-orange-500 text-white font-bold px-6 py-2.5 rounded-full text-sm shadow-sm hover:bg-orange-600 transition-colors active:scale-95"
              >
                お問い合わせする
              </button>
            </div>
          </div>
        )}

        {/* === OBマッチング (Phase 2) === */}
        {activeTab === "ob" && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center shadow-md">
                  <GraduationCap className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">OBマッチング</h3>
                  <p className="text-xs text-gray-500">先輩医師に相談できます</p>
                </div>
              </div>
              <p className="text-xs text-gray-600">
                研修先選び、専門科選択、キャリア相談など、先輩医師に直接相談できるサービスです。
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-xs text-gray-700">
                <span className="font-bold">⚠️ 注意：</span>
                Phase 2 機能のため、現在準備中です。リリース時に LINE Push でお知らせします。
              </p>
            </div>
          </div>
        )}

        {/* === コミュニティ (Phase 2) === */}
        {activeTab === "community" && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-gradient-to-br from-purple-50 to-orange-50 rounded-2xl p-6 border border-purple-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center shadow-md">
                  <Users className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">医学生コミュニティ</h3>
                  <p className="text-xs text-gray-500">仲間と繋がろう</p>
                </div>
              </div>
              <p className="text-xs text-gray-600">
                同じ目標を持つ仲間と情報交換、勉強会、交流イベントなどを開催予定です。
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs text-gray-700">
                <span className="font-bold">💡 ヒント：</span>
                コミュニティ機能は Phase 2 で公開予定です。LINE OpenChat との連携を検討しています。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
        active
          ? "bg-orange-500 text-white shadow-md"
          : "bg-gray-50 text-gray-600 hover:bg-orange-50 border border-gray-100"
      }`}
    >
      {label}
    </button>
  );
}
