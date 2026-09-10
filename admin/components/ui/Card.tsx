import type { ReactNode } from "react";

type CardPadding = "none" | "sm" | "md";

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
};

type CardProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  padding?: CardPadding;
};

// Cards must not be nested inside another Card.
export function Card({ title, description, actions, children, padding = "md" }: CardProps) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white shadow-sm">
      {title || description || actions ? (
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 py-4">
          <div>
            {title ? <h2 className="text-sm font-semibold text-stone-900">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-stone-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={PADDING_CLASSES[padding]}>{children}</div>
    </section>
  );
}
