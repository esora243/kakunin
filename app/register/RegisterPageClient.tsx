"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { OptionSelector } from "@/components/ui/OptionSelector";
import { PageHeader } from "@/components/ui/PageHeader";
import { UniversitySelector } from "@/components/ui/UniversitySelector";
import { readRequiredApiJson } from "@/lib/api-client";
import { parseProfileOptionsResponse, type ProfileOptionsDto } from "@/lib/auth/types";
import {
  applySingleValue,
  buildProfilePayload,
  emptyProfileForm,
  PROFILE_FIELDS,
  singleValueOf,
  type ProfileFormState,
} from "@/lib/profile-form";

const TOTAL_STEPS = PROFILE_FIELDS.length;

export function RegisterPageClient() {
  const router = useRouter();
  const { isLoggedIn, openLoginModal, refreshMe } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<ProfileOptionsDto | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileFormState>(emptyProfileForm);
  const submitInFlightRef = useRef(false);

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);
    setOptionsError(null);
    try {
      const response = await fetch("/api/profile/options", { cache: "no-store" });
      const data = (await response.json()) as unknown;
      const item = parseProfileOptionsResponse(data);
      if (!response.ok || !item) throw new Error("プロフィール選択肢を読み込めませんでした");
      setOptions(item);
    } catch (error) {
      setOptions(null);
      setOptionsError(error instanceof Error ? error.message : "プロフィール選択肢を読み込めませんでした");
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const field = PROFILE_FIELDS[step - 1];

  const handleNext = async () => {
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
      return;
    }

    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setSaving(true);
    try {
      const response = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildProfilePayload(profile, { consentMarketing: false, pushEnabled: false })),
      });
      await readRequiredApiJson(response, "登録に失敗しました", { includeStatusInFallback: true });
      await refreshMe();
      toast.success("登録が完了しました！");
      router.push("/profile");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "登録に失敗しました");
    } finally {
      submitInFlightRef.current = false;
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (field.optional) return true;
    if (field.key === "gender") return profile.gender !== "";
    if (field.key === "graduationYear") return profile.graduationYear !== null;
    if (field.key === "universityId") return profile.universityId !== "";
    return true;
  };

  return (
    <div className="min-h-screen bg-surface-canvas">
      <PageHeader
        sticky
        title="プロフィール登録"
        description="あなたに合う求人・活動を表示するために使います"
        actions={
          <Link
            href="/profile"
            prefetch={false}
            aria-label="マイページへ戻る"
            className="inline-flex min-h-tap min-w-tap items-center justify-center rounded-pill text-secondary transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
        }
      />

      <Container className="space-y-section py-section">
        <div>
          <div className="mb-2 flex items-center justify-between text-meta font-bold">
            <span className="text-secondary">
              STEP {step} / {TOTAL_STEPS}
            </span>
            <span className="text-brand-500">{Math.round((step / TOTAL_STEPS) * 100)}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-pill bg-brand-100"
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
            aria-label="登録の進捗"
          >
            <div
              className="h-full rounded-pill bg-brand-500 transition-all duration-500 ease-out"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        {optionsLoading ? (
          <LoadingState label="プロフィール選択肢を読み込んでいます" />
        ) : optionsError || !options ? (
          <ErrorState
            title="プロフィール選択肢を読み込めませんでした"
            description="通信状態を確認して、もう一度お試しください。"
            detail={optionsError}
            action={
              <Button variant="secondary" onClick={() => void loadOptions()}>
                再読み込み
              </Button>
            }
          />
        ) : (
          <Card className="p-4">
            {field.key === "universityId" ? (
              <UniversitySelector
                universities={options.universities}
                value={profile.universityId || null}
                onChange={(universityId) => setProfile((prev) => ({ ...prev, universityId }))}
              />
            ) : field.multiple ? (
              <OptionSelector
                mode="multiple"
                legend={field.legend}
                description={field.optional ? "（任意・複数選択できます）" : undefined}
                columns={field.columns}
                options={field.options(options)}
                value={profile.clubIds}
                onChange={(clubIds) => setProfile((prev) => ({ ...prev, clubIds }))}
              />
            ) : (
              <OptionSelector
                legend={field.legend}
                description={field.optional ? "（任意）" : undefined}
                columns={field.columns}
                options={field.options(options)}
                value={singleValueOf(profile, field.key)}
                onChange={(id) => setProfile((prev) => applySingleValue(prev, field.key, id))}
              />
            )}
          </Card>
        )}

        <div className="flex gap-3">
          {step > 1 ? (
            <Button variant="secondary" size="lg" fullWidth onClick={() => setStep(step - 1)}>
              戻る
            </Button>
          ) : null}
          <Button size="lg" fullWidth disabled={!canProceed() || saving} onClick={() => void handleNext()}>
            {saving ? "保存中..." : step === TOTAL_STEPS ? "登録完了" : "次へ"}
            {step < TOTAL_STEPS ? <ChevronRight size={18} aria-hidden="true" /> : null}
          </Button>
        </div>
      </Container>
    </div>
  );
}
