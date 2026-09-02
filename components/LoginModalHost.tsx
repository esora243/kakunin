"use client";

import dynamic from "next/dynamic";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthContext";

const LoginModal = dynamic(() => import("@/components/LoginModal").then((module) => module.LoginModal), {
  ssr: false,
});

export function LoginModalHost() {
  const { isLoginModalOpen, closeLoginModal, login, error } = useAuth();

  return (
    <>
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={closeLoginModal}
        error={error}
        onLogin={async (legalConsentVersion) => {
          const result = await login(legalConsentVersion);
          if (result === "authenticated") toast.success("LINEでログインしました");
        }}
      />
    </>
  );
}
