import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cx } from "./cn";

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full min-w-max border-collapse text-[13px] text-stone-700">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-stone-50">
      <tr>{children}</tr>
    </thead>
  );
}

type ThProps = ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" };

export function Th({ children, className, align = "left", ...props }: ThProps) {
  return (
    <th
      className={cx(
        "whitespace-nowrap px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-stone-500",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cx("border-t border-stone-200 hover:bg-stone-50", className)}>{children}</tr>;
}

type TdProps = TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" };

export function Td({ children, className, align = "left", ...props }: TdProps) {
  return (
    <td className={cx("px-4 py-2 align-middle", align === "right" ? "text-right" : "text-left", className)} {...props}>
      {children}
    </td>
  );
}

export function TdMono({ children, className, align = "left", ...props }: TdProps) {
  return (
    <td
      className={cx(
        "px-4 py-2 align-middle font-mono tabular-nums text-stone-600",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}
