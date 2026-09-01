import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Provenance Cleaner — Inspect hidden document signals",
  description: "Scan text for hidden Unicode and provenance signals, clean conservatively, and produce a verification receipt.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
