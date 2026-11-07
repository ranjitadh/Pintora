"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export function EditorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isEditor = pathname.startsWith("/editor");

  return (
    <>
      {!isEditor && <SiteHeader />}
      <main>{children}</main>
      {!isEditor && <SiteFooter />}
    </>
  );
}
