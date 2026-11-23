import assert from "node:assert/strict";
import test from "node:test";
import {
  activeOrderCustomerKeys,
  phoneHasActiveOrder,
  type DeliveryOrder,
} from "./pendingOrders";

function order(phone: string, status: DeliveryOrder["status"]): DeliveryOrder {
  return {
    id: phone,
    createdAt: "2026-11-23T00:00:00.000Z",
    kilometers: 1,
    extraKilometers: 0,
    mojarras: 0,
    empanadas: 0,
    delivery: 40,
    mojarraTotal: 0,
    empanadaTotal: 0,
    total: 40,
    payment: "efectivo",
    customerPhone: phone,
    status,
  };
}

test("active orders match the customer phone with or without the country code", () => {
  const keys = activeOrderCustomerKeys([
    order("5219931175435", "open"),
    order("5219930000000", "closed"),
  ]);
  assert.equal(phoneHasActiveOrder("9931175435", keys), true);
  assert.equal(phoneHasActiveOrder("5219930000000", keys), false);
});
