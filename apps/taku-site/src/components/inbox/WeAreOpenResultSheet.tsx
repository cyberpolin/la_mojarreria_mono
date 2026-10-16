"use client";

export type WeAreOpenRecipient = {
  conversationId: string;
  name: string | null;
  phoneNumber: string;
};

export type WeAreOpenResult = {
  message: string;
  targeted: number;
  sent: number;
  failed: number;
  recipients: WeAreOpenRecipient[];
};

export function WeAreOpenResultSheet({
  result,
  onClose,
}: {
  result: WeAreOpenResult;
  onClose: () => void;
}) {
  const empty = result.recipients.length === 0;

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-slate-950/50 p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Cerrar resultado"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[80%] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">
            {empty
              ? "Nadie para avisar"
              : `Aviso enviado a ${result.sent} ${
                  result.sent === 1 ? "chat" : "chats"
                }`}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {empty
              ? "Nadie escribio fuera de horario desde el ultimo aviso."
              : result.failed
                ? `${result.failed} no se pudieron enviar.`
                : "Clientes que escribieron cuando estaba cerrado."}
          </p>
        </div>
        {empty ? null : (
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {result.recipients.map((recipient) => (
              <li
                key={recipient.conversationId}
                className="border-b border-slate-100 px-4 py-3 last:border-b-0"
              >
                <p className="truncate text-sm font-semibold text-slate-950">
                  {recipient.name?.trim() || recipient.phoneNumber}
                </p>
                {recipient.name?.trim() ? (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {recipient.phoneNumber}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-12 w-full items-center border-t border-slate-100 px-4 text-left text-sm font-semibold text-slate-500 hover:bg-slate-50"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
