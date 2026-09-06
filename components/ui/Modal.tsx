"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type ModalProps = {
  isOpen: boolean;
  onClose?: () => void;
  /** 既定ヘッダーを出す場合のタイトル。custom ヘッダー時は ariaLabelledBy を渡す。 */
  title?: string;
  /** 閉じるボタンの読み上げ名。既定は `<title>を閉じる`。 */
  closeLabel?: string;
  ariaLabelledBy?: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * Esc / 背景クリックで閉じられるか。
   * 同意ゲートのように「閉じさせないこと」自体が要件のモーダルは false。
   */
  dismissible?: boolean;
  /** モバイルで下端シートとして出す */
  variant?: "center" | "sheet";
  size?: "sm" | "md" | "lg";
  panelClassName?: string;
  /** 本文領域のクラス。既定は自身がスクロールする。内側に独自のスクロール域を持つ場合に上書きする。 */
  contentClassName?: string;
};

const SIZES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-app",
  lg: "sm:max-w-2xl",
} as const;

/**
 * ダイアログの唯一の実装。
 * role="dialog" / aria-modal / Esc / 背景クリック / フォーカストラップ /
 * 閉じた後のフォーカス復帰 / 背面スクロールロックをここで担保する。
 * 以前は 3 モーダル中 1 つしか dialog セマンティクスを持たず、
 * Esc 処理はどれも持っていなかった。
 */
export function Modal({
  isOpen,
  onClose,
  title,
  closeLabel,
  ariaLabelledBy,
  children,
  footer,
  dismissible = true,
  variant = "center",
  size = "md",
  panelClassName,
  contentClassName,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const generatedTitleId = useId();
  const titleId = title ? generatedTitleId : ariaLabelledBy;

  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    if (!panel) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.offsetParent !== null,
      );

    (focusables()[0] ?? panel).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!dismissible) return;
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [dismissible, isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={cx(
        "fixed inset-0 z-[100] flex justify-center bg-brand-900/50 p-3 backdrop-blur-sm animate-fade-in sm:p-6",
        variant === "sheet" ? "items-end sm:items-center" : "items-center",
      )}
      onMouseDown={(event) => {
        if (!dismissible) return;
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          "flex w-full flex-col overflow-hidden bg-surface-card shadow-overlay outline-none",
          variant === "sheet" ? "max-h-[90vh] rounded-t-card sm:rounded-card" : "max-h-[92vh] rounded-card",
          SIZES[size],
          panelClassName,
        )}
      >
        {title ? (
          <div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3">
            <h2 id={titleId} className="text-h2 font-bold text-primary">
              {title}
            </h2>
            {dismissible && onClose ? (
              <IconButton label={closeLabel ?? `${title}を閉じる`} onClick={onClose}>
                <X size={20} aria-hidden="true" />
              </IconButton>
            ) : null}
          </div>
        ) : null}

        <div className={cx(contentClassName ?? "min-h-0 flex-1 overflow-y-auto")}>{children}</div>

        {footer ? <div className="border-t border-subtle bg-surface-card p-4">{footer}</div> : null}
      </div>
    </div>
  );
}
