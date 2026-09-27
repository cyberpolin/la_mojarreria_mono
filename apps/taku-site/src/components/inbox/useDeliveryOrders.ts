"use client";

import { useEffect, useState } from "react";
import {
  ORDERS_CHANGED_EVENT,
  listOrdersByStatus,
  type DeliveryOrder,
} from "./pendingOrders";

export function useDeliveryOrders() {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);

  useEffect(() => {
    const sync = () => setOrders(listOrdersByStatus());
    sync();
    window.addEventListener(ORDERS_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ORDERS_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return orders;
}
