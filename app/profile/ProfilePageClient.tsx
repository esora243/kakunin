"use client";

import {
  Bookmark,
  Dumbbell,
  Edit,
  FileText,
  GraduationCap,
  HelpCircle,
  LogOut,
  Mail,
  ShieldCheck,
  Stethoscope,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { ListRow } from "@/components/ui/ListRow";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { LineFriendshipStatus } from "./LineFriendshipStatus";

function ProfilePublicLinks() {
  return (
    <>
      <Card className="overflow-hidden">
        <div className="border-b border-subtle bg-brand-50 px-4 py-3">
          <h2 className="text-body font-bold text-secondary">サポート</h2>
        </div>
        <div className="divide-y divide-subtle">
          <ListRow icon={HelpCircle} label="よくある質問" href="/faq" />
          <ListRow icon={Mail} label="お問い合わせ" href="/contact" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-subtle bg-brand-50 px-4 py-3">
          <h2 className="text-body font-bold text-secondary">サービスについて</h2>
        </div>
        <div className="divide-y divide-subtle">
          <ListRow icon={FileText} label="利用規約" href="/terms" />
          <ListRow icon={ShieldCheck} label="プライバシーポリシー" href="/privacy" />
        </div>
      </Card>
    </>
  );
}

export function ProfilePageClient() {
  const { isLoggedIn, logout, openLoginModal, me, hydrated } = useAuth();
  const router = useRouter();

  if (!hydrated) {
    return (
      <div className="bg-surface-canvas">
        <PageHeader sticky title="マイページ" />
        <Container className="py-section">
          <LoadingState label="プロフィールを読み込んでいます" />
        </Container>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="bg-surface-canvas pb-20">
        <PageHeader sticky title="マイページ" />
        <Container className="space-y-4 py-section">
          <Card className="p-8 text-center">
            <User size={48} className="mx-auto mb-4 text-brand-200" aria-hidden="true" />
            <p className="text-lead font-bold text-primary">ログインが必要です</p>
            <p className="mb-6 mt-2 text-body text-secondary">プロフィールや設定を確認するにはログインが必要です。</p>
            <Button fullWidth onClick={openLoginModal}>
              LINEでログインする
            </Button>
          </Card>

          <ProfilePublicLinks />
        </Container>
      </div>
    );
  }

  const handleLogout = async () => {
    const result = await logout();
    if (result.status === "failed") {
      toast.error("ログアウトに失敗しました。通信状態を確認して、もう一度お試しください。");
      return;
    }
    if (result.status === "partial") {
      toast.warning("Hugmeidからログアウトしましたが、LINE側のログアウトに失敗しました。");
    } else {
      toast.success("ログアウトしました");
    }
    router.push("/");
  };

  const universityLabel = me?.university?.name ?? "";
  const yearLabel = me?.graduationYear ? `${me.graduationYear}年卒` : "";

  return (
    <div className="bg-surface-canvas pb-20">
      <PageHeader
        sticky
        title="マイページ"
        actions={
          me?.isProfileComplete ? (
            <Button variant="secondary" size="sm" onClick={() => router.push("/profile/edit")}>
              <Edit size={16} aria-hidden="true" /> 編集
            </Button>
          ) : undefined
        }
      />

      <Container className="space-y-4 py-section">
        <Card className="p-6 text-center">
          <span className="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-pill border-4 border-surface-card bg-brand-500 text-h1 font-bold text-inverse shadow-raised">
            {universityLabel[0] || "医"}
          </span>
          <p className="text-lead font-bold text-primary">
            {me?.isProfileComplete ? `${universityLabel} ${yearLabel}` : "医学生"}
          </p>
          <p className="mt-1 inline-block rounded-pill border border-subtle bg-brand-50 px-3 py-1 text-meta font-medium text-secondary">
            ID: {me?.lineUidMasked}
          </p>
          {!me?.isProfileComplete ? (
            <div className="mt-4 flex justify-center">
              <Button onClick={() => router.push("/register")}>
                <Edit size={14} aria-hidden="true" /> プロフィールを登録する
              </Button>
            </div>
          ) : null}
        </Card>

        {me?.isProfileComplete ? (
          <Card className="overflow-hidden">
            <div className="border-b border-subtle bg-brand-50 px-4 py-3">
              <h2 className="flex items-center gap-1.5 text-body font-bold text-secondary">
                <User size={16} className="text-brand-500" aria-hidden="true" /> 基本情報
              </h2>
            </div>
            {/* 表示専用の行。押せないので chevron と hover は付けない。 */}
            <div className="divide-y divide-subtle">
              <ListRow icon={GraduationCap} label="大学・卒業年度" value={`${universityLabel} ${yearLabel}`} />
              <ListRow icon={User} label="性別" value={me.gender || "未設定"} />
              {me.clubs.length > 0 ? (
                <ListRow
                  icon={Dumbbell}
                  label="部活・サークル"
                  value={me.clubs.map((club) => club.name).join("、")}
                />
              ) : null}
              {me.desiredSpecialty ? (
                <ListRow icon={Stethoscope} label="希望診療科" value={me.desiredSpecialty.name} />
              ) : null}
            </div>
          </Card>
        ) : null}

        <Card className="overflow-hidden">
          <div className="divide-y divide-subtle">
            <ListRow icon={Bookmark} label="保存済み" href="/profile/saved" />
          </div>
        </Card>

        <ProfilePublicLinks />

        <LineFriendshipStatus />

        <Button variant="danger" size="lg" fullWidth onClick={() => void handleLogout()}>
          <LogOut size={18} aria-hidden="true" /> ログアウト
        </Button>
      </Container>
    </div>
  );
}
