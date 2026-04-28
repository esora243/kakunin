"use client";

import { useMemo, useState } from "react";
import { MessageCircle, HelpCircle, Send, ChevronDown, Mail } from "lucide-react";
import { toast } from "sonner";
import { allFaqs, faqCategories } from "@/lib/data";
import { siteConfig } from "@/lib/site";

export default function ConnectPage() {
  const [activeTab, setActiveTab] = useState<"contact" | "faq">("contact");
  const [formData, setFormData] = useState({ name: "", email: "", category: "", message: "" });
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);
  const [faqCategory, setFaqCategory] = useState<string>("すべて");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("お問い合わせ内容を受け付けました");
    setFormData({ name: "", email: "", category: "", message: "" });
  };

  const categories = useMemo(
    () => (faqCategories.length > 1 ? faqCategories : ["すべて", ...Array.from(new Set(allFaqs.map((faq) => faq.category)))]),
    [],
  );
  const filteredFaqs = faqCategory === "すべて" ? allFaqs : allFaqs.filter((f) => f.category === faqCategory);

  return (
    <div className="w-full max-w-lg mx-auto pb-8 animate-slide-in-right">
      <div className="sticky top-[20px] z-30 bg-white border-b border-pink-100 px-4 py-4">
        <h2 className="text-xl font-bold text-gray-800 mb-4">繋がり</h2>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab("contact")} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "contact" ? "bg-pink-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-pink-50"}`}>💬 お問い合わせ</button>
          <button onClick={() => setActiveTab("faq")} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "faq" ? "bg-pink-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-pink-50"}`}>❓ FAQ</button>
        </div>
      </div>

      <div className="px-4 pt-3">
        {activeTab === "contact" ? (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl p-6 border border-pink-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-pink-500 flex items-center justify-center shadow-md"><MessageCircle className="text-white" size={24} /></div>
                <div><h3 className="font-bold text-gray-800">お問い合わせ</h3><p className="text-xs text-gray-500">ご質問・掲載依頼・不具合報告</p></div>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">フォーム送信時の実処理は未接続です。実運用ではAPI連携または外部フォームURLに差し替えてください。</p>
            </div>
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-pink-50 p-6 space-y-5">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-2 block">お名前 *</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="山田 太郎" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-2 block">メールアドレス *</label>
                <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="example@email.com" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-2 block">お問い合わせ種別 *</label>
                <select required value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm">
                  <option value="">選択してください</option>
                  <option value="contact">掲載・提携相談</option>
                  <option value="question">サービスについての質問</option>
                  <option value="bug">不具合報告</option>
                  <option value="request">機能リクエスト</option>
                  <option value="other">その他</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-2 block">お問い合わせ内容 *</label>
                <textarea required value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} placeholder="お問い合わせ内容をご記入ください" rows={6} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm resize-none" />
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-pink-400 to-pink-500 text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95">
                <Send size={18} /> 送信する
              </button>
            </form>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-gray-700 flex items-start gap-3">
              <Mail className="text-blue-500 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="font-bold mb-1">連絡先</p>
                <p>{siteConfig.contactEmail}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100 mb-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center shadow-md"><HelpCircle className="text-white" size={24} /></div>
                <div><h3 className="font-bold text-gray-800">よくある質問</h3><p className="text-xs text-gray-500">FAQ</p></div>
              </div>
              <p className="text-xs text-gray-600">運用FAQを登録するとここに表示されます。</p>
            </div>
            <div className="flex overflow-x-auto gap-2 pb-4 hide-scrollbar">
              {categories.map((cat) => (
                <button key={cat} onClick={() => setFaqCategory(cat)} className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${faqCategory === cat ? "bg-blue-500 text-white shadow-md" : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300"}`}>{cat}</button>
              ))}
            </div>
            <div className="space-y-3">
              {filteredFaqs.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-pink-50 p-6 text-center text-sm text-gray-500">FAQはまだ登録されていません。</div>
              ) : filteredFaqs.map((faq) => (
                <div key={faq.id} className="bg-white rounded-xl shadow-sm border border-pink-50 overflow-hidden">
                  <button onClick={() => setOpenFaqId(openFaqId === faq.id ? null : faq.id)} className="w-full p-4 flex items-start justify-between text-left hover:bg-pink-50/50 transition-colors">
                    <div className="flex-1 pr-3">
                      <div className="flex items-center gap-2 mb-2"><span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-600 rounded">{faq.category}</span></div>
                      <div className="flex items-start gap-2"><span className="shrink-0 text-pink-500 font-bold text-sm mt-0.5">Q.</span><span className="text-sm font-bold text-gray-800 leading-snug">{faq.question}</span></div>
                    </div>
                    <ChevronDown size={20} className={`text-gray-400 shrink-0 transition-transform ${openFaqId === faq.id ? "rotate-180" : ""}`} />
                  </button>
                  {openFaqId === faq.id && (
                    <div className="px-4 pb-4 pt-0 border-t border-gray-50">
                      <div className="flex items-start gap-2 bg-pink-50/50 p-3 rounded-lg"><span className="shrink-0 text-blue-500 font-bold text-sm mt-0.5">A.</span><p className="text-sm text-gray-700 leading-relaxed">{faq.answer}</p></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
