import type { Metadata, Viewport } from "next";
import { HeaderNav } from "@/components/navigation/header-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOJARRERIA",
  description: "MOJARRERIA web app",
  applicationName: "MOJARRERIA",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MOJARRERIA",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/mojarreria-icon.svg",
    apple: "/icons/mojarreria-icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#020617",
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
