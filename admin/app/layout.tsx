import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { recordAdminAccessEventIfNeeded } from "@/lib/audit";
import { AdminAccessDenied } from "@/components/AdminAccessDenied";
import { AdminShell } from "@/components/AdminShell";
import { assertAdminRuntimeConfig } from "@/lib/runtime-config";

export const metadata: Metadata = {
  title: "Hugmeid Admin",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  assertAdminRuntimeConfig();
  const identity = await getAdminIdentityForPage();

  if (!identity) {
    return (
      <html lang="ja">
        <body className="font-sans">
          <AdminAccessDenied />
        </body>
      </html>
    );
  }

  await recordAdminAccessEventIfNeeded(identity);

  return (
    <html lang="ja">
      <body className="font-sans">
        <AdminShell identity={identity}>{children}</AdminShell>
      </body>
    </html>
  );
}
