import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TAKU Restaurant",
  description:
    "Cierre de caja, gastos, pedidos por WhatsApp y operacion diaria para restaurantes pequenos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
