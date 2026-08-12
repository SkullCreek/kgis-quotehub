import type { Metadata } from "next";
import "./globals.css";
import { COMPANY } from "@/config/company";

export const metadata: Metadata = {
  title: `${COMPANY.name} — Quotations & Invoices`,
  description: `Create GST quotations and invoices for ${COMPANY.name}.`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
