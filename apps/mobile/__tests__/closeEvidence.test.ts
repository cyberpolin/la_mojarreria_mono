import {
  CLOSE_EVIDENCE_SLOTS,
  hasAllCloseEvidence,
  upsertCloseEvidence,
} from "../app/DailyCloseFeature/closeEvidence";
import { CloseEvidencePhoto } from "../app/DailyCloseFeature/Types";

const photo = (kind: CloseEvidencePhoto["kind"]): CloseEvidencePhoto => ({
  kind,
  localUri: `file://${kind}.jpg`,
  takenAt: "2026-10-07T23:00:00.000Z",
});

describe("closeEvidence", () => {
  it("requires the four close photos", () => {
    expect(CLOSE_EVIDENCE_SLOTS.map((slot) => slot.kind)).toEqual([
      "bathroom_clean",
      "bathroom_closed",
      "dining",
      "trash",
    ]);
    expect(CLOSE_EVIDENCE_SLOTS[0]?.instruction).toMatch(/baño quedó limpio/i);
    expect(hasAllCloseEvidence([])).toBe(false);
    expect(
      hasAllCloseEvidence([
        photo("bathroom_clean"),
        photo("bathroom_closed"),
        photo("dining"),
      ]),
    ).toBe(false);
    expect(
      hasAllCloseEvidence([
        photo("bathroom_clean"),
        photo("bathroom_closed"),
        photo("dining"),
        photo("trash"),
      ]),
    ).toBe(true);
  });

  it("replaces a photo of the same kind", () => {
    const first = photo("trash");
    const second = {
      ...photo("trash"),
      localUri: "file://trash-2.jpg",
    };
    const next = upsertCloseEvidence([first, photo("dining")], second);
    expect(next).toHaveLength(2);
    expect(next.find((item) => item.kind === "trash")?.localUri).toBe(
      "file://trash-2.jpg",
    );
  });
});
