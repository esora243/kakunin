"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { cx } from "@/components/ui/cx";

type DetailScaffoldProps = {
  /** ヘッダーバーの小見出し (ページの h1 は children 側に置く) */
  title: string;
  backLabel: string;
  backHref?: string;
  onBack?: () => void;
  actions?: ReactNode;
  /** 画面下端に固定する CTA。渡した場合は本文に安全余白が入る。 */
  bottomBar?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * 詳細画面の骨格。
 * 戻る操作 (以前は 4 種類) ・ヘッダー高・下部余白 (以前は 3 種類) を 1 つに揃える。
 */
export function DetailScaffold({
  title,
  backLabel,
  backHref,
  onBack,
  actions,
  bottomBar,
  children,
  className,
}: DetailScaffoldProps) {
  const back = backHref ? (
    <Link
      href={backHref}
      prefetch={false}
      aria-label={backLabel}
      className="inline-flex min-h-tap min-w-tap items-center justify-center rounded-pill text-secondary transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <ArrowLeft size={20} aria-hidden="true" />
    </Link>
  ) : (
    <IconButton label={backLabel} onClick={onBack}>
      <ArrowLeft size={20} aria-hidden="true" />
    </IconButton>
  );

  return (
    <div className={cx("min-h-screen bg-surface-canvas", className)}>
      <div className="sticky top-sticky z-30 border-b border-subtle bg-surface-card">
        <Container className="flex items-center gap-2 py-2">
          {back}
          <span className="min-w-0 flex-1 truncate text-center text-body font-bold text-primary">{title}</span>
          <div className="flex shrink-0 items-center gap-1">
            {actions ?? <span className="inline-block min-w-tap" aria-hidden="true" />}
          </div>
        </Container>
      </div>

      <Container className={cx("py-section", bottomBar ? "pb-bottom-bar" : "pb-section")}>{children}</Container>

      {bottomBar ? (
        <div className="fixed bottom-browser left-0 right-0 z-40 border-t border-subtle bg-surface-card p-3 shadow-bar">
          <Container className="flex items-stretch gap-3">{bottomBar}</Container>
        </div>
      ) : null}
    </div>
  );
}
