"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Chatbot } from "@/components/chatbot";

export function EditorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isEditor = pathname.startsWith("/editor");
  const isAdmin = pathname.startsWith("/admin");

  return (
    <>
      {!isEditor && !isAdmin && <SiteHeader />}
      <main>{children}</main>
      {!isEditor && !isAdmin && <SiteFooter />}
      {!isEditor && !isAdmin && <Chatbot />}
    </>
  );
}
