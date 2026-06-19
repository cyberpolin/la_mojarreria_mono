"use client";

import type { TakuChatMessage } from "./types";

export function MediaPreview({ message }: { message: TakuChatMessage }) {
  if (message.type === "text") return null;

  if (message.mediaUrl && message.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={message.mediaUrl}
        alt={message.fileName ?? "WhatsApp image"}
        className="mb-2 max-h-72 rounded-lg border border-slate-700 object-contain"
      />
    );
  }

  return (
    <div className="mb-2 rounded-lg border border-dashed border-slate-700 bg-slate-950 p-3 text-xs text-slate-400">
      {message.type.toUpperCase()} media
      {message.fileName ? ` · ${message.fileName}` : ""}
      <div className="mt-1 text-[11px] text-slate-500">
        TODO: connect media download endpoint when wa-service exposes stored
        media files.
      </div>
    </div>
  );
}
