import type { ReactNode } from "react";
import { cx } from "./cn";

type DescriptionListItem = {
  label: string;
  value: ReactNode;
  mono?: boolean;
};

export function DescriptionList({ items }: { items: DescriptionListItem[] }) {
  return (
    <dl className="divide-y divide-stone-200">
      {items.map((item) => (
        <div key={item.label} className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm text-stone-500">{item.label}</dt>
          <dd className={cx("text-sm text-stone-900 sm:col-span-2", item.mono && "font-mono tabular-nums")}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DL({ children }: { children: ReactNode }) {
  return <dl className="divide-y divide-stone-200">{children}</dl>;
}

export function DLRow({ label, mono, children }: { label: string; mono?: boolean; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-stone-500">{label}</dt>
      <dd className={cx("text-sm text-stone-900 sm:col-span-2", mono && "font-mono tabular-nums")}>{children}</dd>
    </div>
  );
}
