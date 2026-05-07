import type { Metadata } from "next";

const PAPAS_GRATIS_URL =
  process.env.NEXT_PUBLIC_PAPAS_GRATIS_URL ??
  "https://papas-gratis-gudv8gzbc-kondosoft-team.vercel.app/";

export const metadata: Metadata = {
  title: "Papas Gratis | MOJARRERIA",
  description: "Promocion de papas gratis de MOJARRERIA",
};

export default function PapasGratisPage() {
  return (
    <main className="min-h-[calc(100vh-57px)] bg-slate-950">
      <iframe
        src={PAPAS_GRATIS_URL}
        title="Papas Gratis"
        className="h-[calc(100vh-57px)] w-full border-0"
        allow="clipboard-write"
      />
    </main>
  );
}
