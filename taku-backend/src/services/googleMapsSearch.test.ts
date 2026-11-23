import assert from "node:assert/strict";
import test from "node:test";
import {
  readGoogleMapsEmbedPlace,
  readGoogleMapsLink,
} from "./googleMapsSearch.js";

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

test("reads a shared Google Maps place link", () => {
  const place = readGoogleMapsLink(
    "https://www.google.com/maps/place/Parque+Tom%C3%A1s+Garrido/@17.9901,-92.9402,17z/data=!3d17.9973759!4d-92.9388612",
  );
  assert.equal(place?.latitude, 17.9973759);
  assert.equal(place?.longitude, -92.9388612);
  assert.equal(place?.name, "Parque Tomás Garrido");
});

test("reads coordinates from a maps query link", () => {
  const place = readGoogleMapsLink("https://maps.google.com/?q=17.989,-92.928");
  assert.equal(place?.latitude, 17.989);
  assert.equal(place?.longitude, -92.928);
});

test("a short share link has no pin until it is opened", () => {
  assert.equal(readGoogleMapsLink("https://maps.app.goo.gl/abcDEF12"), null);
});
