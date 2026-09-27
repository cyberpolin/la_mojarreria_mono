"use client";

import { useEffect, useState } from "react";
import { digitsPhone } from "./helpers";
import { listDeliveryOrders } from "./pendingOrders";

export const DRIVERS_STORAGE_KEY = "MOJARRERIA_TAKU_DRIVERS";
export const DRIVERS_STORAGE_VERSION = 1;
const DRIVERS_CHANGED_EVENT = "mojarreria-drivers-changed";

type DriversPayload = {
  version: number;
  phones: string[];
};

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function phonesFromOrders() {
  const phones = new Set<string>();
  for (const order of listDeliveryOrders()) {
    const phone = digitsPhone(order.assignedDriver?.phone ?? "");
    if (phone) phones.add(phone);
  }
  return phones;
}

function readDriverPhones() {
  const phones = phonesFromOrders();
  if (!canUseStorage()) return [...phones];
  try {
    const raw = window.localStorage.getItem(DRIVERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DriversPayload>;
      if (Array.isArray(parsed.phones)) {
        for (const phone of parsed.phones) {
          const digits = digitsPhone(String(phone));
          if (digits) phones.add(digits);
        }
      }
    }
  } catch {
    // Keep phones collected from assigned orders.
  }
  return [...phones];
}

function writeDriverPhones(phones: string[]) {
  if (!canUseStorage()) return;
  const payload: DriversPayload = {
    version: DRIVERS_STORAGE_VERSION,
    phones: [
      ...new Set(phones.map((phone) => digitsPhone(phone)).filter(Boolean)),
    ],
  };
  window.localStorage.setItem(DRIVERS_STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new Event(DRIVERS_CHANGED_EVENT));
}

export function rememberDriverPhone(phone: string) {
  const digits = digitsPhone(phone);
  if (!digits) return;
  writeDriverPhones([...readDriverPhones(), digits]);
}

export function isKnownDriverPhone(phone: string | null | undefined) {
  const digits = digitsPhone(phone ?? "");
  if (!digits) return false;
  return readDriverPhones().includes(digits);
}

export function useKnownDriverPhones() {
  const [phones, setPhones] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setPhones(readDriverPhones());
    sync();
    window.addEventListener(DRIVERS_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DRIVERS_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return phones;
}

export function isDriverInList(
  phones: string[],
  phone: string | null | undefined,
) {
  const digits = digitsPhone(phone ?? "");
  return Boolean(digits) && phones.includes(digits);
}
