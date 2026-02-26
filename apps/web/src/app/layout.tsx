import type { Metadata } from "next";
import { HeaderNav } from "@/components/navigation/header-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOJARRERIA",
  description: "MOJARRERIA web app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-slate-950 text-slate-100">
          <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
            <HeaderNav />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
