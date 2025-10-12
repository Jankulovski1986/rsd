import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ausschreibungen",
  description: "Tabelle + Neu-Modal + KPIs"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
