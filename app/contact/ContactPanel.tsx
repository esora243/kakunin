"use client";

import { Mail, MessageCircle, Send } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type ContactFormData = {
  name: string;
  email: string;
  category: string;
  message: string;
};

type ContactPanelProps = {
  contactEmail: string;
};

const initialFormData: ContactFormData = { name: "", email: "", category: "", message: "" };

const contactCategories = [
  { value: "contact", label: "掲載・提携相談" },
  { value: "question", label: "サービスについての質問" },
  { value: "bug", label: "不具合報告" },
  { value: "request", label: "機能リクエスト" },
  { value: "other", label: "その他" },
] as const;

const fieldClassName =
  "min-h-tap w-full rounded-control border border-subtle bg-surface-card px-4 py-3 text-body text-primary placeholder:text-tertiary focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25";

function buildMailtoHref(contactEmail: string, formData: ContactFormData) {
  const subject = encodeURIComponent(`Hugmeid お問い合わせ: ${formData.category}`);
  const body = encodeURIComponent(
    [
      `お名前: ${formData.name}`,
      `メールアドレス: ${formData.email}`,
      `お問い合わせ種別: ${formData.category}`,
      "",
      formData.message,
    ].join("\n"),
  );

  return `mailto:${contactEmail}?subject=${subject}&body=${body}`;
}

export function ContactPanel({ contactEmail }: ContactPanelProps) {
  const [formData, setFormData] = useState<ContactFormData>(initialFormData);
  const fieldId = useId();

  const updateField =
    (field: keyof ContactFormData) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setFormData((current) => ({ ...current, [field]: event.target.value }));
    };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    window.location.href = buildMailtoHref(contactEmail, formData);
    toast.info("メールアプリを開きます。送信内容をご確認ください。");
  };

  return (
    <div className="space-y-4">
      <Card className="bg-brand-50 p-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-control bg-brand-500 shadow-card">
            <MessageCircle className="text-inverse" size={24} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-body font-bold text-primary">お問い合わせ</span>
            <span className="block text-meta text-secondary">ご質問・掲載依頼・不具合報告</span>
          </span>
        </div>
        <p className="text-meta leading-relaxed text-secondary">
          送信ボタンからメールアプリを開きます。送信内容を確認してから送信してください。
        </p>
      </Card>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor={`${fieldId}-name`} className="mb-2 block text-meta font-bold text-secondary">
              お名前 *
            </label>
            <input
              id={`${fieldId}-name`}
              type="text"
              required
              value={formData.name}
              onChange={updateField("name")}
              placeholder="山田 太郎"
              className={fieldClassName}
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-email`} className="mb-2 block text-meta font-bold text-secondary">
              メールアドレス *
            </label>
            <input
              id={`${fieldId}-email`}
              type="email"
              required
              value={formData.email}
              onChange={updateField("email")}
              placeholder="taro@example.jp"
              className={fieldClassName}
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-category`} className="mb-2 block text-meta font-bold text-secondary">
              お問い合わせ種別 *
            </label>
            <select
              id={`${fieldId}-category`}
              required
              value={formData.category}
              onChange={updateField("category")}
              className={fieldClassName}
            >
              <option value="">選択してください</option>
              {contactCategories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${fieldId}-message`} className="mb-2 block text-meta font-bold text-secondary">
              お問い合わせ内容 *
            </label>
            <textarea
              id={`${fieldId}-message`}
              required
              value={formData.message}
              onChange={updateField("message")}
              placeholder="お問い合わせ内容をご記入ください"
              rows={6}
              className={`${fieldClassName} resize-none`}
            />
          </div>
          <Button type="submit" size="lg" fullWidth>
            <Send size={18} aria-hidden="true" /> 送信する
          </Button>
        </form>
      </Card>

      <Card className="flex items-start gap-3 border-info-100 bg-info-50 p-4">
        <Mail className="mt-0.5 shrink-0 text-info-500" size={18} aria-hidden="true" />
        <div className="text-body text-secondary">
          <p className="mb-1 font-bold text-primary">連絡先</p>
          <p>{contactEmail}</p>
        </div>
      </Card>
    </div>
  );
}
