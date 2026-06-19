"use client";

import { KeyboardEvent } from "react";

export function MessageInput({
  value,
  disabled,
  sending,
  onChange,
  onSend,
}: {
  value: string;
  disabled: boolean;
  sending: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    onSend();
  }

  return (
    <div className="flex items-end gap-2 border-t border-slate-800 bg-slate-950 p-3">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || sending}
        rows={1}
        placeholder={disabled ? "Selecciona un chat" : "Escribe un mensaje"}
        className="max-h-32 min-h-11 flex-1 resize-none rounded-lg border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={disabled || sending || !value.trim()}
        className="min-h-11 rounded-lg border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-950 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
      >
        {sending ? "Enviando" : "Enviar"}
      </button>
    </div>
  );
}
