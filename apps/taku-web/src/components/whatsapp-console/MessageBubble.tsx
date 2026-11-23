"use client";

import type { TakuChatMessage } from "./types";
import { MediaPreview } from "./MediaPreview";

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const statusLabels: Record<TakuChatMessage["status"], string> = {
  sent: "enviado",
  delivered: "entregado",
  read: "leido",
  error: "error",
};

export function MessageBubble({ message }: { message: TakuChatMessage }) {
  return (
    <div className={`flex ${message.fromMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] rounded-lg border px-3 py-2 text-sm shadow-sm ${
          message.fromMe
            ? "border-slate-600 bg-slate-100 text-slate-950"
            : "border-slate-800 bg-slate-900 text-slate-100"
        }`}
      >
        <MediaPreview message={message} />
        {message.body ? (
          <p className="whitespace-pre-wrap break-words leading-5">
            {message.body}
          </p>
        ) : null}
        <div
          className={`mt-1 flex justify-end gap-2 text-[11px] ${
            message.fromMe ? "text-slate-600" : "text-slate-500"
          }`}
        >
          <span>{formatTime(message.timestamp)}</span>
          {message.fromMe ? <span>{statusLabels[message.status]}</span> : null}
        </div>
      </div>
    </div>
  );
}
