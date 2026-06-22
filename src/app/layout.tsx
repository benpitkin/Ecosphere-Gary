import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import AskGaryWidget from "@/app/_components/AskGaryWidget";

export const metadata: Metadata = {
  title: "Gary — Ecosphere Energy",
  description: "Quoting and system-design assistant for Ecosphere Energy.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <AskGaryWidget />
      </body>
    </html>
  );
}
