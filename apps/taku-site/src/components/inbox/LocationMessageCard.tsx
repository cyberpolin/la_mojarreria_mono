import { cx } from "./helpers";
import type { InboxMessage } from "./types";

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

export function LocationMessageCard({
  message,
  inverted = false,
}: {
  message: InboxMessage;
  inverted?: boolean;
}) {
  const href = locationMapsUrl(message);
  const detail =
    message.body?.trim() && message.body.trim() !== "Ubicacion"
      ? message.body.trim()
      : null;

  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold">Ubicacion</p>
      {detail ? (
        <p className="text-[13px] leading-5 opacity-80">{detail}</p>
      ) : null}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cx(
            "inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold underline",
            inverted ? "bg-white/10 text-white" : "bg-slate-100 text-slate-950",
          )}
        >
          Abrir en Maps
        </a>
      ) : (
        <p className="text-[13px] opacity-70">Sin coordenadas</p>
      )}
    </div>
  );
}
