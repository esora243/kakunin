import type { ReactNode } from "react";
import { cx } from "./cn";

export type BannerVariant = "error" | "warning" | "info" | "success";

const BANNER_STYLES: Record<BannerVariant, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

type BannerProps = {
  variant: BannerVariant;
  title?: string;
  children: ReactNode;
};

export function Banner({ variant, title, children }: BannerProps) {
  return (
    <div
      role={variant === "error" ? "alert" : undefined}
      className={cx("rounded-md border px-4 py-3 text-sm", BANNER_STYLES[variant])}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? "mt-1" : undefined}>{children}</div>
    </div>
  );
}
