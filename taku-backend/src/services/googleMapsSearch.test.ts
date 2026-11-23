import assert from "node:assert/strict";
import test from "node:test";
import {
  kilometersFromMeters,
  readDirectionsDistanceMeters,
  readDirectionsPreviewPath,
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

test("reads the destination from a directions share link", () => {
  const place = readGoogleMapsLink(
    "https://www.google.com/maps/dir/17.9791114,-92.9465924/La+Mojarrer%C3%ADa,+Calle+Lic.+Eduardo+Alday+Hern%C3%A1ndez+344,+Atasta+de+Serra,+86100+Villahermosa,+Tab./@17.9786415,-92.9483861,18z/data=!3m1!4b1!4m10!4m9!1m1!4e1!1m5!1m1!1s0x85edd700554eb103:0x7975a78179935d59!2m2!1d-92.9465782!2d17.9792954!3e0",
  );
  assert.equal(place?.name, "La Mojarrería");
  assert.equal(place?.latitude, 17.9792954);
  assert.equal(place?.longitude, -92.9465782);
});

test("reads the driving distance from a directions preview", () => {
  const payload = `)]}'\n[[null,[[[null,"Ignacio Altamirano",[1085,"1,1 km",0],[232,"4 min"]]]]]]`;
  assert.equal(readDirectionsDistanceMeters(payload), 1085);
  assert.equal(kilometersFromMeters(1085), 1.1);
  assert.equal(readDirectionsDistanceMeters("not json"), null);
});

test("reads the directions preview path from an embed page", () => {
  const html = `<a href="/maps/preview/directions?hl=es&amp;pb=!1m4">ruta</a>`;
  assert.equal(
    readDirectionsPreviewPath(html),
    "/maps/preview/directions?hl=es&pb=!1m4",
  );
});
