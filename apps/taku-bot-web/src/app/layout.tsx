import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TAKU Bot",
  description: "TAKU bot administration console.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
