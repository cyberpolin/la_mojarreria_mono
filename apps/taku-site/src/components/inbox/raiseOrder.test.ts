import assert from "node:assert/strict";
import test from "node:test";
import { deliveryCost, extraDeliveryKilometers } from "./raiseOrder";

test("the first 4 km stay inside the base fare", () => {
  assert.equal(extraDeliveryKilometers(0), 0);
  assert.equal(extraDeliveryKilometers(4), 0);
  assert.equal(deliveryCost(4), 40);
});

test("each km or fraction above 4 adds 10 pesos", () => {
  assert.equal(extraDeliveryKilometers(4.1), 1);
  assert.equal(deliveryCost(4.1), 50);
  assert.equal(extraDeliveryKilometers(5), 1);
  assert.equal(deliveryCost(5), 50);
  assert.equal(extraDeliveryKilometers(5.1), 2);
  assert.equal(deliveryCost(5.1), 60);
  assert.equal(deliveryCost(6), 60);
});
