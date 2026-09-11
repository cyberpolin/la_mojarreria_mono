import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "TAKU chat",
  robots: "noindex",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function ConversationMobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
