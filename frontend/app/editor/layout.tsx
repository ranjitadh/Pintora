import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Studio — MerchPress",
    template: "%s · Studio · MerchPress",
  },
};

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
