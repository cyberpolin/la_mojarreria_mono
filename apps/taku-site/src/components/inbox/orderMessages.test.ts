import assert from "node:assert/strict";
import test from "node:test";
import {
  customerAssignmentMessage,
  driverAssignmentMessage,
  fillMessageTemplate,
} from "./orderMessages";
import type { DeliveryOrder } from "./pendingOrders";

const order = {
  id: "order",
  createdAt: "2026-11-23T00:00:00.000Z",
  kilometers: 5,
  extraKilometers: 1,
  mojarras: 2,
  empanadas: 1,
  delivery: 50,
  mojarraTotal: 300,
  empanadaTotal: 100,
  total: 450,
  payment: "efectivo",
  customerPhone: "5219931175435",
  assignedDriver: {
    phone: "5219930001111",
    name: "Luis",
    assignedAt: "2026-11-23T00:00:00.000Z",
  },
} as DeliveryOrder;

test("fills tokens written with braces or angles", () => {
  assert.equal(
    fillMessageTemplate("Hola {cliente} <Total>", {
      cliente: "5219931175435",
      total: "$450.00",
    }),
    "Hola 5219931175435 $450.00",
  );
  assert.equal(
    fillMessageTemplate("Queda {otro}", { cliente: "1" }),
    "Queda {otro}",
  );
});

test("assignment messages use the saved template", () => {
  assert.equal(
    driverAssignmentMessage(order, "Cobra {a_cobrar} a {cliente}"),
    "Cobra $450.00 a 5219931175435",
  );
  assert.equal(
    customerAssignmentMessage(order, "Va <repartidor> en {tiempo} min"),
    "Va 5219930001111 en 40 min",
  );
});

test("a transfer only asks the driver to collect the delivery", () => {
  const message = driverAssignmentMessage({
    ...order,
    payment: "transferencia",
  });
  assert.match(message, /A pagar: \$0\.00/);
  assert.match(message, /A cobrar: \$50\.00/);
});
