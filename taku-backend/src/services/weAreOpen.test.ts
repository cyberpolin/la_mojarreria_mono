import assert from "node:assert/strict";
import { test } from "node:test";
import {
  conversationWroteWhileClosed,
  isBusinessOpenAt,
  WE_ARE_OPEN_REASON,
} from "./weAreOpen.js";
import type { BusinessHour } from "../types.js";

const timeZone = "America/Mexico_City";
const now = new Date("2026-10-16T18:00:00.000Z");
const hours: BusinessHour[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  id: `h${day}`,
  workspaceId: "ws",
  whatsappAccountId: null,
  dayOfWeek: day,
  opensAt: "11:00",
  closesAt: "17:00",
  isClosed: day === 1 || day === 2 || day === 3 || day === 4,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
}));

test("Friday 10am Mexico is closed", () => {
  assert.equal(
    isBusinessOpenAt(hours, new Date("2026-10-16T16:00:00.000Z"), timeZone),
    false,
  );
});

test("Friday noon Mexico is open", () => {
  assert.equal(
    isBusinessOpenAt(hours, new Date("2026-10-16T18:00:00.000Z"), timeZone),
    true,
  );
});

test("closed inbound qualifies until we_are_open is sent", () => {
  assert.equal(
    conversationWroteWhileClosed({
      conversation: { id: "c1" },
      hours,
      timeZone,
      now,
      messages: [
        {
          conversationId: "c1",
          direction: "inbound",
          status: "received",
          createdAt: "2026-10-16T16:00:00.000Z",
        },
      ],
      logs: [],
    }),
    true,
  );
});

test("another FAQ-style after_hours log also qualifies", () => {
  assert.equal(
    conversationWroteWhileClosed({
      conversation: { id: "c1" },
      hours,
      timeZone,
      now,
      messages: [],
      logs: [
        {
          conversationId: "c1",
          reason: "after_hours",
          createdAt: "2026-10-16T16:05:00.000Z",
        },
      ],
    }),
    true,
  );
});

test("already notified conversations are skipped", () => {
  assert.equal(
    conversationWroteWhileClosed({
      conversation: { id: "c1" },
      hours,
      timeZone,
      now,
      messages: [
        {
          conversationId: "c1",
          direction: "inbound",
          status: "received",
          createdAt: "2026-10-16T16:00:00.000Z",
        },
      ],
      logs: [
        {
          conversationId: "c1",
          reason: WE_ARE_OPEN_REASON,
          createdAt: "2026-10-16T18:10:00.000Z",
        },
      ],
    }),
    false,
  );
});

test("human reply after the closed inbound skips the blast", () => {
  assert.equal(
    conversationWroteWhileClosed({
      conversation: { id: "c1" },
      hours,
      timeZone,
      now,
      messages: [
        {
          conversationId: "c1",
          direction: "inbound",
          status: "received",
          createdAt: "2026-10-16T16:00:00.000Z",
        },
        {
          conversationId: "c1",
          direction: "outbound",
          status: "sent",
          createdAt: "2026-10-16T16:20:00.000Z",
        },
      ],
      logs: [],
    }),
    false,
  );
});

test("closed inbound from a previous week is skipped", () => {
  assert.equal(
    conversationWroteWhileClosed({
      conversation: { id: "c1" },
      hours,
      timeZone,
      now,
      messages: [
        {
          conversationId: "c1",
          direction: "inbound",
          status: "received",
          createdAt: "2026-10-08T16:00:00.000Z",
        },
      ],
      logs: [],
    }),
    false,
  );
});

test("closed inbound from Monday of the current week still qualifies", () => {
  assert.equal(
    conversationWroteWhileClosed({
      conversation: { id: "c1" },
      hours,
      timeZone,
      now,
      messages: [
        {
          conversationId: "c1",
          direction: "inbound",
          status: "received",
          createdAt: "2026-10-12T16:00:00.000Z",
        },
      ],
      logs: [],
    }),
    true,
  );
});
