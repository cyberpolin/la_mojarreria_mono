import assert from "node:assert/strict";
import test from "node:test";
import { readGoogleMapsEmbedPlace } from "./googleMapsSearch.js";

test("reads the place pin from a Google Maps embed page", () => {
  const html = `initEmbed([null,[["0x1:0x2","Parque Tomás Garrido Canabal, Jesus Garcia, 86040 Villahermosa, Tab.",[17.9973759,-92.93886119999999]],"Parque Tomás Garrido Canabal"]]);`;
  assert.deepEqual(readGoogleMapsEmbedPlace(html), {
    name: "Parque Tomás Garrido Canabal",
    address:
      "Parque Tomás Garrido Canabal, Jesus Garcia, 86040 Villahermosa, Tab.",
    latitude: 17.9973759,
    longitude: -92.93886119999999,
  });
});

test("ignores an embed page without a place pin", () => {
  assert.equal(readGoogleMapsEmbedPlace("<html></html>"), null);
});
