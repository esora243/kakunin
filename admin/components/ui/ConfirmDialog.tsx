"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// Mount once, near the root (see AdminShell), so useConfirm() works from any
// descendant without each caller wiring up its own dialog element.
export function ConfirmDialog({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (state) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [state]);

  const settle = useCallback((value: boolean) => {
    setState((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          event.preventDefault();
          settle(false);
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) settle(false);
        }}
        className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-0 shadow-lg"
      >
        {state ? (
          <div className="p-5">
            <div className="flex items-start gap-3">
              {state.danger ? (
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
              ) : null}
              <div>
                <h2 className="text-sm font-semibold text-stone-900">{state.title}</h2>
                {state.description ? <p className="mt-1 text-sm text-stone-500">{state.description}</p> : null}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => settle(false)}>
                {state.cancelLabel ?? "キャンセル"}
              </Button>
              <Button type="button" variant={state.danger ? "danger" : "primary"} size="sm" onClick={() => settle(true)}>
                {state.confirmLabel ?? "実行"}
              </Button>
            </div>
          </div>
        ) : null}
      </dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used within ConfirmDialog");
  }
  return confirm;
}
