"use client";

import {
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

export function MobileAuthGate({ next }: { next: string }) {
  return (
    <main className="flex min-h-dvh items-stretch justify-center bg-slate-950">
      <div className="grid h-dvh w-full max-w-[390px] place-items-center bg-slate-100 px-4">
        <a
          href={`/login?next=${encodeURIComponent(next)}`}
          className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
        >
          Inicia sesion para ver WhatsApp
        </a>
      </div>
    </main>
  );
}

export function MobilePhoneFrame({ children }: { children: ReactNode }) {
  return (
    <main
      id="taku-mobile-frame"
      className="flex min-h-dvh items-stretch justify-center bg-slate-950"
    >
      <div className="relative flex h-dvh w-full max-w-[390px] flex-col overflow-hidden bg-slate-100 text-slate-950 shadow-2xl">
        {children}
      </div>
    </main>
  );
}

export function KebabIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "h-5 w-5"}
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="19" r="2" fill="currentColor" />
    </svg>
  );
}

export function longPressProps(onLongPress: () => void) {
  const touchStyle: CSSProperties = {
    WebkitTouchCallout: "none",
    WebkitUserSelect: "none",
    userSelect: "none",
  };

  return {
    style: touchStyle,
    onContextMenu: (event: { preventDefault: () => void }) => {
      event.preventDefault();
      onLongPress();
    },
    onPointerDown: (event: ReactPointerEvent) => {
      if (event.button !== 0) return;
      const startX = event.clientX;
      const startY = event.clientY;
      let timerId: number | null = window.setTimeout(() => {
        timerId = null;
        onLongPress();
        const blockClick = (clickEvent: MouseEvent) => {
          clickEvent.preventDefault();
          clickEvent.stopPropagation();
        };
        window.addEventListener("click", blockClick, true);
        window.setTimeout(() => {
          window.removeEventListener("click", blockClick, true);
        }, 900);
      }, 450);
      const onMove = (moveEvent: PointerEvent) => {
        if (
          Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) >
          12
        ) {
          if (timerId !== null) window.clearTimeout(timerId);
          timerId = null;
        }
      };
      const onUp = () => {
        if (timerId !== null) window.clearTimeout(timerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
  };
}

export function MobileContextMenu({
  title,
  items,
  onClose,
}: {
  title?: string;
  items: Array<{
    label: string;
    danger?: boolean;
    onSelect: () => void;
  }>;
  onClose: () => void;
}) {
  const readyRef = useRef(false);

  useEffect(() => {
    readyRef.current = false;
    const timeoutId = window.setTimeout(() => {
      readyRef.current = true;
    }, 320);
    return () => window.clearTimeout(timeoutId);
  }, []);

  function closeIfReady() {
    if (!readyRef.current) return;
    onClose();
  }

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-slate-950/50 p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Cerrar menu"
        onPointerDown={(event) => {
          event.preventDefault();
          closeIfReady();
        }}
      />
      <div className="relative z-10 w-full overflow-hidden rounded-2xl bg-white shadow-xl">
        {title ? (
          <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
            {title}
          </p>
        ) : null}
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              if (!readyRef.current) return;
              item.onSelect();
              onClose();
            }}
            className={`flex min-h-12 w-full items-center px-4 text-left text-sm font-medium ${
              item.danger ? "font-semibold text-slate-950" : "text-slate-800"
            } hover:bg-slate-50`}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          onClick={closeIfReady}
          className="flex min-h-12 w-full items-center border-t border-slate-100 px-4 text-left text-sm font-semibold text-slate-500 hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
