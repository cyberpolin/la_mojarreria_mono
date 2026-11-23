import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TAKU",
  description:
    "TAKU connects WhatsApp infrastructure and customer-relation bots for growing businesses.",
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
