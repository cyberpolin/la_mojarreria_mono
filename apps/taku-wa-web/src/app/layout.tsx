import type { Metadata } from "next";
import { PasswordSetupWarning } from "./password-setup-warning";
import "./globals.css";

export const metadata: Metadata = {
  title: "TAKU WhatsApp Bridge",
  description:
    "Developer-first WhatsApp API for pairing phones, sending messages, and receiving inbound webhooks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PasswordSetupWarning />
        {children}
      </body>
    </html>
  );
}
