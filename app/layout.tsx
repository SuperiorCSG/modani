import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Care Log Automation Admin",
  description: "Admin-only care log automation and review dashboard"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
