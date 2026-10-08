import { CloseEvidenceKind, CloseEvidencePhoto } from "./Types";

export const CLOSE_EVIDENCE_SLOTS: {
  kind: CloseEvidenceKind;
  label: string;
  instruction: string;
}[] = [
  {
    kind: "bathroom_clean",
    label: "Baño limpio",
    instruction:
      "Por favor asegúrate que el baño quedó limpio, sin papeles ni basura.",
  },
  {
    kind: "bathroom_closed",
    label: "Baño cerrado",
    instruction: "Por favor asegúrate que el baño quedó cerrado y con candado.",
  },
  {
    kind: "dining",
    label: "Comedor",
    instruction:
      "Por favor asegúrate que el área de comedor quedó recogida y limpia.",
  },
  {
    kind: "trash",
    label: "Basura",
    instruction:
      "Por favor asegúrate que el bote de basura quedó cerrado y sin desbordar.",
  },
];

export const hasAllCloseEvidence = (photos: CloseEvidencePhoto[]) =>
  CLOSE_EVIDENCE_SLOTS.every((slot) =>
    photos.some((photo) => photo.kind === slot.kind && Boolean(photo.localUri)),
  );

export const upsertCloseEvidence = (
  photos: CloseEvidencePhoto[],
  next: CloseEvidencePhoto,
) => {
  const withoutKind = photos.filter((photo) => photo.kind !== next.kind);
  return [...withoutKind, next];
};
