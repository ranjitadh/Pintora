import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Studio — Printora",
    template: "%s · Studio · Printora",
  },
};

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
