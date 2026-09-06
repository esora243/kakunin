"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/AuthContext";
import { LoginModalHost } from "@/components/LoginModalHost";

export function AuthBoundary({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <LoginModalHost />
    </AuthProvider>
  );
}
