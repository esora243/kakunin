"use client";

import { ArrowLeft, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
  canSaveProfile,
  emptyProfileForm,
  PROFILE_FIELDS,
  profileFormFromMe,
  singleValueOf,
  type ProfileFormState,
} from "@/lib/profile-form";

export function ProfileEditPageClient() {
  const router = useRouter();
  const { hydrated, isLoggedIn, me, openLoginModal, refreshMe } = useAuth();
  const [options, setOptions] = useState<ProfileOptionsDto | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileFormState>(emptyProfileForm);

  const loadOptions = useCallback(async () => {
    if (!isLoggedIn) return;
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
  }, [isLoggedIn]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    if (!me) return;
    setProfile(profileFormFromMe(me));
  }, [me]);

  const handleSave = async () => {
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          buildProfilePayload(profile, {
            consentMarketing: Boolean(me?.consentMarketingAt),
            pushEnabled: me?.pushEnabled ?? false,
          }),
        ),
      });
      await readRequiredApiJson(response, "プロフィール更新に失敗しました", { includeStatusInFallback: true });
      await refreshMe();
      toast.success("プロフィールを更新しました");
      router.push("/profile");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "プロフィール更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const backButton = (
    <button
      type="button"
      onClick={() => router.push("/profile")}
      aria-label="マイページへ戻る"
      className="inline-flex min-h-tap min-w-tap items-center justify-center rounded-pill text-secondary transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <ArrowLeft size={20} aria-hidden="true" />
    </button>
  );

  const shell = (children: React.ReactNode, actions?: React.ReactNode) => (
    <div className="min-h-screen bg-surface-canvas pb-20">
      <PageHeader sticky title="プロフィール編集" actions={actions ?? backButton} />
      <Container className="space-y-section py-section">{children}</Container>
    </div>
  );

  if (!hydrated) {
    return shell(<LoadingState label="プロフィールを読み込んでいます" />);
  }

  if (!isLoggedIn) {
    return shell(
      <Card className="p-8 text-center">
        <p className="text-lead font-bold text-primary">ログインが必要です</p>
        <p className="mb-6 mt-2 text-body text-secondary">プロフィールを編集するにはログインが必要です。</p>
        <Button fullWidth onClick={openLoginModal}>
          LINEでログインする
        </Button>
      </Card>,
    );
  }

  if (optionsLoading || !options) {
    return shell(
      optionsLoading ? (
        <LoadingState label="プロフィール選択肢を読み込んでいます" />
      ) : (
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
      ),
    );
  }

  const saveAction = (
    <>
      {backButton}
      <Button size="sm" disabled={saving || !canSaveProfile(profile)} onClick={() => void handleSave()}>
        <Save size={16} aria-hidden="true" /> {saving ? "保存中" : "保存"}
      </Button>
    </>
  );

  return shell(
    // /register と同じ大学専用セレクターと汎用 OptionSelector を使う。
    PROFILE_FIELDS.map((field) => (
      <Card key={field.key} className="p-4">
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
    )),
    saveAction,
  );
}
