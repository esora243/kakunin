"use client";

import { Bookmark, Briefcase, Newspaper, Target, Trash2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/AuthContext";
import { useSavedItems } from "@/components/SavedItemsContext";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { savedItemEntityId, type SavedItemDto } from "@/lib/saved-items";

/**
 * kakunin /saved/page.tsx のクロス・カテゴリー UI を移植:
 * - 保存済み一覧のカードにアイコン枠 + タイプラベルバッジ + メタ行を追加。
 * - 未ログイン時は大型プロンプトとログインボタンを表示する。
 */
function display(item: SavedItemDto) {
  if (item.type === "job")
    return {
      title: item.job.title,
      subtitle: item.job.companyName ?? "求人",
      meta: item.job.location ?? "",
      href: `/jobs/${item.job.slug}`,
    };
  if (item.type === "activity")
    return {
      title: item.activity.title,
      subtitle: item.activity.hostName,
      meta: item.activity.location ?? "",
      href: `/activities/${item.activity.slug}`,
    };
  return {
    title: item.content.title,
    subtitle: item.content.category.name,
    meta: "",
    href: `/contents/${item.content.slug}`,
  };
}

function typeMeta(item: SavedItemDto): { label: string; icon: LucideIcon } {
  if (item.type === "job") return { label: "求人", icon: Briefcase };
  if (item.type === "activity") return { label: "課外活動", icon: Target };
  return { label: "コンテンツ", icon: Newspaper };
}

function SavedShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-canvas pb-20">
      <PageHeader sticky title="保存済み" description="求人・課外活動・コンテンツをまとめて確認" />
      <Container className="space-y-4 py-section">{children}</Container>
    </div>
  );
}

export function ProfileSavedClient() {
  const { isLoggedIn, openLoginModal } = useAuth();
  const { savedItems, hydrated, syncing, error, removeSaved } = useSavedItems();

  if (!isLoggedIn) {
    return (
      <SavedShell>
        <Card className="p-8 text-center">
          <Bookmark size={48} className="mx-auto mb-4 text-brand-200" aria-hidden="true" />
          <p className="text-lead font-bold text-primary">ログインが必要です</p>
          <p className="mb-6 mt-2 text-body text-secondary">保存した求人や活動・記事を見るにはログインが必要です。</p>
          <Button fullWidth onClick={openLoginModal}>
            LINEでログインする
          </Button>
        </Card>
      </SavedShell>
    );
  }

  const resolved = savedItems.map((item) => ({
    item,
    info: display(item),
    id: savedItemEntityId(item),
    type: typeMeta(item),
  }));

  return (
    <SavedShell>
      {!hydrated || syncing ? (
        <LoadingState label="保存済みアイテムを読み込んでいます" />
      ) : error ? (
        <ErrorState
          title="保存済みアイテムを取得できませんでした"
          description="通信状態を確認して、もう一度お試しください。"
          detail={error}
          icon={Bookmark}
        />
      ) : resolved.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="保存済みアイテムはまだありません"
          description="記事・求人・活動の詳細から保存すると、ここに一覧表示されます。"
        />
      ) : (
        resolved.map(({ item, info, id, type }) => {
          const TypeIcon = type.icon;
          return (
            <Card key={`${item.type}:${id}`} interactive className="flex items-start gap-3 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-brand-50 text-brand-500">
                <TypeIcon size={20} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <Badge className="mb-1">{type.label}</Badge>
                <Link
                  href={info.href}
                  prefetch={false}
                  className="block rounded-control text-body font-bold text-primary transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  {info.title}
                </Link>
                <p className="mt-1 text-body text-secondary">{info.subtitle}</p>
                {info.meta ? <p className="mt-1 text-meta text-tertiary">{info.meta}</p> : null}
              </div>
              <IconButton label={`${info.title}の保存を解除`} onClick={() => void removeSaved(item.type, id)}>
                <Trash2 size={18} aria-hidden="true" />
              </IconButton>
            </Card>
          );
        })
      )}
    </SavedShell>
  );
}
