"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, ShieldCheck, ChevronDown } from "lucide-react";
import {
  LegalDocument,
  PRIVACY_POLICY,
  TERMS_OF_SERVICE,
} from "@/lib/legal";

type Tab = "terms" | "privacy";

type LegalConsentModalProps = {
  isOpen: boolean;
  onAgree: () => void;
};

/**
 * 初回起動時に表示される「利用規約 / プライバシーポリシー」同意モーダル。
 * TestAPP のデザインを完全移植 (カラーパレット: #11204C / #1E3A8A / #B9C2DB)。
 *
 * - タブで利用規約とプライバシーポリシーを切り替え可能
 * - 両方の本文を最下部までスクロールし、かつ同意チェックボックスをオンにしないと
 *   「同意して始める」ボタンが有効化されない
 */
export function LegalConsentModal({ isOpen, onAgree }: LegalConsentModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("terms");
  const [termsScrolled, setTermsScrolled] = useState(false);
  const [privacyScrolled, setPrivacyScrolled] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const termsScrollRef = useRef<HTMLDivElement | null>(null);
  const privacyScrollRef = useRef<HTMLDivElement | null>(null);

  // モーダルが開いている間はページ本体のスクロールをロック
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  const bothScrolled = termsScrolled && privacyScrolled;
  const canAgree = bothScrolled && agreed;

  const handleScroll = (
    e: React.UIEvent<HTMLDivElement>,
    tab: Tab,
  ) => {
    const el = e.currentTarget;
    const reachedBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight <= 16;
    if (!reachedBottom) return;
    if (tab === "terms") setTermsScrolled(true);
    else setPrivacyScrolled(true);
  };

  const scrollActiveToBottom = () => {
    const ref = activeTab === "terms" ? termsScrollRef : privacyScrollRef;
    ref.current?.scrollTo({
      top: ref.current.scrollHeight,
      behavior: "smooth",
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-consent-title"
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div
          className="px-6 pt-6 pb-5 text-white"
          style={{ background: "linear-gradient(135deg, #11204C 0%, #1E3A8A 100%)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center backdrop-blur-sm">
              <ShieldCheck size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <h2
                id="legal-consent-title"
                className="text-lg font-bold leading-tight"
              >
                ご利用にあたって
              </h2>
              <p className="text-xs text-white/80 mt-0.5">
                HugNaviをご利用いただく前に、以下の内容をご確認ください。
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: "#E5E9F2" }}>
          <TabButton
            active={activeTab === "terms"}
            done={termsScrolled}
            onClick={() => setActiveTab("terms")}
            label="利用規約"
          />
          <TabButton
            active={activeTab === "privacy"}
            done={privacyScrolled}
            onClick={() => setActiveTab("privacy")}
            label="プライバシーポリシー"
          />
        </div>

        {/* Body */}
        <div className="relative flex-1 min-h-0 bg-[#F8FAFD]">
          <ScrollPanel
            innerRef={termsScrollRef}
            visible={activeTab === "terms"}
            document={TERMS_OF_SERVICE}
            onScroll={(e) => handleScroll(e, "terms")}
          />
          <ScrollPanel
            innerRef={privacyScrollRef}
            visible={activeTab === "privacy"}
            document={PRIVACY_POLICY}
            onScroll={(e) => handleScroll(e, "privacy")}
          />

          {((activeTab === "terms" && !termsScrolled) ||
            (activeTab === "privacy" && !privacyScrolled)) && (
            <button
              type="button"
              onClick={scrollActiveToBottom}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#1E3A8A] text-white text-xs shadow-lg hover:bg-[#17307a] transition-colors"
            >
              <ChevronDown size={14} />
              最後までスクロールして確認
            </button>
          )}
        </div>

        {/* Footer / Agreement */}
        <div className="border-t bg-white px-5 sm:px-6 py-4" style={{ borderColor: "#E5E9F2" }}>
          {!bothScrolled && (
            <p className="text-[11px] text-gray-500 mb-2.5 flex items-center gap-1.5">
              <FileText size={13} className="shrink-0" />
              両方の内容を最後までご確認ください
              <span className="ml-auto text-[10px] font-medium">
                <span className={termsScrolled ? "text-[#1E3A8A]" : "text-gray-400"}>
                  利用規約 {termsScrolled ? "✓" : "…"}
                </span>
                <span className="mx-1.5 text-gray-300">/</span>
                <span className={privacyScrolled ? "text-[#1E3A8A]" : "text-gray-400"}>
                  プライバシーポリシー {privacyScrolled ? "✓" : "…"}
                </span>
              </span>
            </p>
          )}

          <label
            className={`flex items-start gap-2.5 cursor-pointer select-none rounded-lg px-2 py-2 transition-colors ${
              bothScrolled ? "hover:bg-[#F2F4F8]" : "opacity-60 cursor-not-allowed"
            }`}
          >
            <input
              type="checkbox"
              checked={agreed}
              disabled={!bothScrolled}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#1E3A8A] shrink-0"
            />
            <span className="text-sm text-gray-700 leading-relaxed">
              上記の<span className="font-semibold text-[#1E3A8A]">利用規約</span>および
              <span className="font-semibold text-[#1E3A8A]">プライバシーポリシー</span>
              の内容を確認し、同意します。
            </span>
          </label>

          <button
            type="button"
            disabled={!canAgree}
            onClick={() => canAgree && onAgree()}
            className={`mt-3 w-full py-3.5 rounded-xl font-semibold text-white shadow-sm transition-all active:scale-[0.98] ${
              canAgree
                ? "bg-[#1E3A8A] hover:bg-[#17307a]"
                : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            同意して始める
          </button>

          <p className="text-[10px] text-center text-gray-400 mt-2.5 leading-relaxed">
            「同意して始める」を押すと、HugNaviの利用規約およびプライバシーポリシーに同意したものとみなされます。
          </p>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  done,
  onClick,
  label,
}: {
  active: boolean;
  done: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 relative py-3 text-sm font-semibold transition-colors ${
        active ? "text-[#1E3A8A]" : "text-gray-500 hover:text-gray-700"
      }`}
    >
      <span className="inline-flex items-center gap-1.5">
        {label}
        {done && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#1E3A8A] text-white text-[9px] font-bold">
            ✓
          </span>
        )}
      </span>
      {active && (
        <span
          className="absolute left-0 right-0 bottom-0 h-[3px]"
          style={{ backgroundColor: "#1E3A8A" }}
        />
      )}
    </button>
  );
}

function ScrollPanel({
  visible,
  document,
  onScroll,
  innerRef,
}: {
  visible: boolean;
  document: LegalDocument;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  innerRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const style = useMemo(
    () => (visible ? {} : { display: "none" }),
    [visible],
  );

  return (
    <div
      ref={innerRef}
      onScroll={onScroll}
      style={style}
      className="absolute inset-0 overflow-y-auto px-5 sm:px-7 py-5 text-[13px] leading-relaxed text-gray-700"
    >
      <h3 className="text-base font-bold text-[#11204C]">{document.title}</h3>
      <p className="text-[11px] text-gray-500 mt-1">{document.meta}</p>
      <p className="mt-3 text-[13px]">{document.intro}</p>

      <div className="mt-4 space-y-4">
        {document.sections.map((section) => (
          <section key={section.heading}>
            <h4 className="font-semibold text-[#1E3A8A] text-sm mb-1.5">
              {section.heading}
            </h4>
            <div className="space-y-1.5">
              {section.paragraphs.map((p, i) => (
                <p key={i} className="text-[13px] whitespace-pre-wrap">
                  {p}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      {document.outro && (
        <p className="mt-6 mb-2 text-center text-xs text-gray-400">
          {document.outro}
        </p>
      )}
    </div>
  );
}
