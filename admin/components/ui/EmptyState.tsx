import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {Icon ? <Icon size={28} strokeWidth={1.5} className="mb-1 text-stone-300" aria-hidden="true" /> : null}
      <p className="text-sm font-semibold text-stone-900">{title}</p>
      {description ? <p className="max-w-sm text-sm text-stone-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
