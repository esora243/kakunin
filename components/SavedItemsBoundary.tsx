"use client";

import type { ReactNode } from "react";
import { AuthBoundary } from "@/components/AuthBoundary";
import { SavedItemsProvider } from "@/components/SavedItemsContext";

export function SavedItemsBoundary({ children }: { children: ReactNode }) {
  return (
    <AuthBoundary>
      <SavedItemsProvider>{children}</SavedItemsProvider>
    </AuthBoundary>
  );
}
