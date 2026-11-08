"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { EditorShell } from "@/components/editor-layout";
import { AdminSidebar, AdminMobileHeader } from "@/components/admin";
import { useAuth } from "@/lib/auth";
import { LoadingBlock, LinkButton } from "@/components/ui";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, isAdmin, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) return <LoadingBlock label="Opening the studio…" />;

  if (!user) {
    return (
      <div className="container-x py-20 text-center">
        <p className="eyebrow">Studio admin</p>
        <h1 className="mt-2 font-display text-4xl">Sign in to continue.</h1>
        <p className="mt-2 text-sm text-muted">The admin studio is private to store staff.</p>
        <LinkButton href="/login?next=/admin" className="mt-6">Sign in</LinkButton>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container-x py-20 text-center">
        <p className="eyebrow">Studio admin</p>
        <h1 className="mt-2 font-display text-4xl">You don&apos;t have access.</h1>
        <p className="mt-2 text-sm text-muted">This area is limited to store administrators.</p>
        <LinkButton href="/" className="mt-6" variant="secondary">Back to the shop</LinkButton>
      </div>
    );
  }

  return (
    <EditorShell>
      <div className="flex lg:flex-row flex-col min-h-screen">
        <AdminSidebar />

        <div className="flex-1 min-w-0">
          <div className="container-x relative z-10">
            <AdminMobileHeader title="Studio" onMenu={() => setMobileMenuOpen(true)} />

            {children}

            {/* Mobile backdrop rendered by AdminSidebar component */}
          </div>
        </div>
      </div>
    </EditorShell>
  );
}
