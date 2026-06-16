import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TAKU Console",
  description: "WhatsApp connection administration for TAKU",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
