import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SOMDAS Content Editor",
  description: "Manage SOMDAS sections, partners and community activities.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head><link rel="stylesheet" href="/typography.css" /></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
