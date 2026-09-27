"use client";

import { useState } from "react";
import { RaiseOrderModal } from "./RaiseOrderModal";
import { cx } from "./helpers";
import type { InboxMessage, InboxWhatsAppAccount } from "./types";

export function isLocationMessage(message: {
  type?: string;
  latitude?: number | null;
  longitude?: number | null;
  mediaUrl?: string | null;
}) {
  return (
    message.type === "location" ||
    (typeof message.latitude === "number" &&
      typeof message.longitude === "number")
  );
}

export function locationMapsUrl(message: InboxMessage) {
  if (
    typeof message.latitude === "number" &&
    typeof message.longitude === "number"
  ) {
    return `https://maps.google.com/?q=${message.latitude},${message.longitude}`;
  }
  if (message.mediaUrl && /^https?:\/\//i.test(message.mediaUrl)) {
    return message.mediaUrl;
  }
  return null;
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
    </svg>
  );
}

export function LocationMessageCard({
  message,
  inverted = false,
  account = null,
}: {
  message: InboxMessage;
  inverted?: boolean;
  account?: InboxWhatsAppAccount | null;
}) {
  const href = locationMapsUrl(message);
  const [orderOpen, setOrderOpen] = useState(false);
  const detail =
    message.body?.trim() && message.body.trim() !== "Ubicacion"
      ? message.body.trim()
      : null;

  return (
    <div className="grid w-full min-w-[240px] gap-3">
      <div
        className={cx(
          "grid h-36 place-items-center rounded-xl",
          inverted ? "bg-white/10" : "bg-slate-200",
        )}
      >
        <div className="grid justify-items-center gap-1 text-center">
          <PinIcon
            className={cx(
              "h-10 w-10",
              inverted ? "text-white" : "text-slate-700",
            )}
          />
          <p className="text-sm font-semibold">Ubicacion</p>
          {detail ? (
            <p className="max-w-[220px] px-3 text-[12px] leading-4 opacity-80">
              {detail}
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-2">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className={cx(
              "inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold",
              inverted
                ? "bg-white text-slate-950 hover:bg-slate-100"
                : "bg-slate-950 text-white hover:bg-slate-800",
            )}
          >
            Abrir en Maps
          </a>
        ) : (
          <p className="text-[13px] opacity-70">Sin coordenadas</p>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setOrderOpen(true);
          }}
          className={cx(
            "inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold",
            inverted
              ? "border border-white/40 bg-white/10 text-white hover:bg-white/20"
              : "border border-slate-300 bg-white text-slate-950 hover:border-slate-950",
          )}
        >
          Levantar pedido
        </button>
      </div>
      {orderOpen ? (
        <RaiseOrderModal
          account={account}
          onClose={() => setOrderOpen(false)}
        />
      ) : null}
    </div>
  );
}
