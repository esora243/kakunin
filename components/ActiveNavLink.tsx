"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type ActiveNavLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
};

export function ActiveNavLink({
  href,
  children,
  className = "",
  activeClassName = "",
  inactiveClassName = "",
}: ActiveNavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      prefetch={false}
      className={[className, isActive ? activeClassName : inactiveClassName].filter(Boolean).join(" ")}
    >
      {children}
    </Link>
  );
}
