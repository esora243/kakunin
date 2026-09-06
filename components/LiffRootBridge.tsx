"use client";

import { useEffect, useRef, useState } from "react";
import { initLiff } from "@/lib/liff/client";

export function LiffRootBridge() {
  const [initializationFailed, setInitializationFailed] = useState(false);
  const overlayRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    overlayRef.current?.focus();

    void (async () => {
      try {
        await initLiff();
        if (!cancelled) window.location.replace("/school");
      } catch {
        if (!cancelled) setInitializationFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      ref={overlayRef}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-surface-canvas px-6 text-center"
      onKeyDown={(event) => {
        if (event.key === "Tab") event.preventDefault();
      }}
      tabIndex={-1}
    >
      <noscript>
        <a className="text-sm font-medium text-brand-600 underline" href="/school">
          学校ページへ進む
        </a>
      </noscript>
      {initializationFailed ? (
        <div>
          <p className="text-sm text-red-700">LINEログインの初期化に失敗しました。</p>
          <a autoFocus className="mt-4 inline-block text-sm font-medium text-brand-600 underline" href="/school">
            学校ページへ進む
          </a>
        </div>
      ) : (
        <p aria-live="polite" className="text-sm text-gray-600">
          読み込み中…
        </p>
      )}
    </section>
  );
}
