import assert from "node:assert/strict";
import test from "node:test";
import {
  activeOrderCustomerKeys,
  isSystemCloseDue,
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

test("an open order closes at 6pm on the day it was made", () => {
  const made = {
    ...order("5219931175435", "open"),
    createdAt: "2026-11-23T21:00:00.000Z",
  };
  assert.equal(isSystemCloseDue(made, new Date("2026-11-23T23:59:00.000Z")), false);
  assert.equal(isSystemCloseDue(made, new Date("2026-11-24T00:00:00.000Z")), true);
  assert.equal(isSystemCloseDue(made, new Date("2026-11-24T14:00:00.000Z")), true);
  assert.equal(
    isSystemCloseDue(
      { ...made, status: "closed", closedBy: "user" },
      new Date("2026-11-24T00:00:00.000Z"),
    ),
    false,
  );
});

test("an order made after 6pm waits until 6pm the next day", () => {
  const late = {
    ...order("5219931175435", "open"),
    createdAt: "2026-11-24T00:30:00.000Z",
  };
  assert.equal(isSystemCloseDue(late, new Date("2026-11-24T02:00:00.000Z")), false);
  assert.equal(isSystemCloseDue(late, new Date("2026-11-25T00:00:00.000Z")), true);
});

test("active orders match the customer phone with or without the country code", () => {
  const keys = activeOrderCustomerKeys([
    order("5219931175435", "open"),
    order("5219930000000", "closed"),
  ]);
  assert.equal(phoneHasActiveOrder("9931175435", keys), true);
  assert.equal(phoneHasActiveOrder("5219930000000", keys), false);
});
