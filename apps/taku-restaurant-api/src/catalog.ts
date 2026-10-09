export const DEFAULT_PRODUCTS = [
  {
    clientId: "001",
    name: "Mojarra Frita",
    priceCents: 15000,
  },
  {
    clientId: "002",
    name: "Empanada de Camaron con Queso (Orden)",
    priceCents: 10000,
  },
  {
    clientId: "003",
    name: "Empanada de Minilla (Orden)",
    priceCents: 10000,
  },
] as const;

export const EVIDENCE_KINDS = [
  "bathroom_clean",
  "bathroom_closed",
  "dining",
  "trash",
] as const;

export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];
