"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LEGAL_CONSENT_VERSION, type LegalConsentVersion } from "@/lib/legal-consent";

type LoginModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (legalConsentVersion: LegalConsentVersion) => Promise<void>;
  error?: string | null;
};

export function LoginModal({ isOpen, onClose, onLogin, error }: LoginModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const consentId = useId();

  useEffect(() => {
    if (!isOpen) {
      setAgreed(false);
      setSubmitting(false);
    }
  }, [isOpen]);

  const handleLogin = async () => {
    if (!agreed || submitting) return;
    setSubmitting(true);
    try {
      await onLogin(LEGAL_CONSENT_VERSION);
    } catch {
      // AuthProvider owns the user-facing error message.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="ログインが必要です"
      closeLabel="ログイン画面を閉じる"
      size="sm"
    >
      <div className="px-6 pb-4 pt-5 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-pill bg-brand-100 text-lead font-bold text-brand-500">
          H
        </span>
        <p className="text-body leading-relaxed text-secondary">
          保存機能や応募、詳細なコンテンツの閲覧にはログインが必要です。
        </p>
      </div>

      <div className="bg-brand-50 p-6">
        <div className="mb-4 rounded-control border border-subtle bg-surface-card p-4 text-left">
          <p className="text-body leading-relaxed text-secondary">
            続行する前に、
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-600 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              利用規約
            </Link>
            と
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-600 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              プライバシーポリシー
            </Link>
            をご確認ください。
          </p>
          <label
            htmlFor={consentId}
            className="mt-3 flex min-h-tap cursor-pointer select-none items-start gap-2.5 rounded-control py-2 text-body leading-relaxed text-primary focus-within:ring-2 focus-within:ring-brand-500"
          >
            <input
              id={consentId}
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-brand-500"
            />
            <span>利用規約およびプライバシーポリシーに同意します。</span>
          </label>
        </div>

        {/* LINE ログインは LINE 連携そのものなので line variant を使う。 */}
        <Button
          variant="line"
          size="lg"
          fullWidth
          disabled={submitting || !agreed}
          onClick={() => void handleLogin()}
        >
          <MessageCircle size={22} aria-hidden="true" />
          {submitting ? "確認中..." : "LINEでログイン・登録"}
        </Button>

        {error ? (
          <p role="alert" className="mt-3 text-center text-caption leading-relaxed text-danger-700">
            {error}
          </p>
        ) : null}

      </div>
    </Modal>
  );
}
