import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cx } from "./cn";

const FIELD_CLASSES =
  "w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40";

type FormSectionProps = {
  title?: string;
  description?: string;
  children: ReactNode;
};

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="space-y-4 border-b border-stone-200 py-6 first:pt-0 last:border-b-0 last:pb-0">
      {title || description ? (
        <div>
          {title ? <h2 className="text-sm font-semibold text-stone-900">{title}</h2> : null}
          {description ? <p className="mt-1 text-sm text-stone-500">{description}</p> : null}
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

type FieldLabelProps = {
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
};

export function FieldLabel({ htmlFor, required, children }: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-sm font-medium text-stone-700">
      {children}
      {required ? (
        <span className="rounded-sm bg-orange-50 px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-orange-600">
          必須
        </span>
      ) : null}
    </label>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export function TextInput({ className, ...props }: TextInputProps) {
  return <input className={cx(FIELD_CLASSES, className)} {...props} />;
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextArea({ className, ...props }: TextAreaProps) {
  return <textarea className={cx(FIELD_CLASSES, className)} {...props} />;
}

type SelectInputProps = SelectHTMLAttributes<HTMLSelectElement>;

export function SelectInput({ className, children, ...props }: SelectInputProps) {
  return (
    <select className={cx(FIELD_CLASSES, className)} {...props}>
      {children}
    </select>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-stone-500">{children}</p>;
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="text-xs font-medium text-red-600">{children}</p>;
}
