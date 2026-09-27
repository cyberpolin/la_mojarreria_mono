import {
  INBOX_ORDER_PARAM,
  inboxOrderSearch,
  mobileListPath,
  withQuery,
} from "./helpers";
import type { InboxWhatsAppAccount } from "./types";

const RETURN_ORDER_KEY = "MOJARRERIA_TAKU_RETURN_ORDER";

export function rememberReturnOrder(orderId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(RETURN_ORDER_KEY, orderId);
}

export function readReturnOrderId() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(RETURN_ORDER_KEY);
}

export function clearReturnOrder() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(RETURN_ORDER_KEY);
}

type SearchLike =
  | string
  | { get(name: string): string | null }
  | null
  | undefined;

export function orderIdFromSearch(search: SearchLike) {
  if (!search) return null;
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  return params.get(INBOX_ORDER_PARAM);
}

export function inboxListReturnPath(
  account?: InboxWhatsAppAccount | null,
  search?: SearchLike,
) {
  const orderId = orderIdFromSearch(search) || readReturnOrderId();
  return withQuery(mobileListPath(account), inboxOrderSearch(orderId));
}

export function hasOrderReturn(search?: SearchLike) {
  return Boolean(orderIdFromSearch(search) || readReturnOrderId());
}
