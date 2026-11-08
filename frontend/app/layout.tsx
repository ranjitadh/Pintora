import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { EditorShell } from "@/components/editor-layout";

export const metadata: Metadata = {
  title: {
    default: "Printora — Design it. Customize it. Make it yours.",
    template: "%s · Printora",
  },
  description:
    "Printora is a product personalization studio. Design custom apparel, drinkware, totes and more with our live editor, then we print and ship it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AuthProvider>
          <EditorShell>{children}</EditorShell>
        </AuthProvider>
      </body>
    </html>
  );
}