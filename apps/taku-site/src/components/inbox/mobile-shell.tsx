"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";

const PULL_REFRESH_THRESHOLD = 56;

export function PullToRefresh({
  onRefresh,
  className,
  children,
  id,
  onClick,
}: {
  onRefresh: () => Promise<void> | void;
  className?: string;
  children: ReactNode;
  id?: string;
  onClick?: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const atTop = () => (scrollerRef.current?.scrollTop ?? 0) <= 0;

  const onTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (refreshing || !atTop()) {
      pulling.current = false;
      return;
    }
    pulling.current = true;
    startY.current = event.touches[0]?.clientY ?? 0;
  };

  const onTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (!pulling.current || refreshing) return;
    if (!atTop()) {
      pulling.current = false;
      setOffset(0);
      return;
    }
    const dy = (event.touches[0]?.clientY ?? 0) - startY.current;
    if (dy <= 0) {
      setOffset(0);
      return;
    }
    setOffset(Math.min(dy * 0.45, 88));
  };

  const onTouchEnd = () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (offset < PULL_REFRESH_THRESHOLD) {
      setOffset(0);
      return;
    }
    setRefreshing(true);
    setOffset(48);
    void Promise.resolve(onRefresh()).finally(() => {
      setRefreshing(false);
      setOffset(0);
    });
  };

  return (
    <div
      ref={scrollerRef}
      id={id}
      className={className}
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        className="flex items-end justify-center overflow-hidden text-[11px] font-medium text-slate-500"
        style={{ height: offset }}
      >
        {refreshing || offset >= PULL_REFRESH_THRESHOLD
          ? "Actualizando..."
          : offset > 12
            ? "Suelta para recargar"
            : null}
      </div>
      {children}
    </div>
  );
}

export function MobileAuthGate({ next }: { next: string }) {
  return (
    <main className="flex min-h-dvh w-full items-stretch justify-center bg-slate-950">
      <div className="grid h-dvh w-full place-items-center bg-slate-100 px-4">
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
      className="flex min-h-dvh w-full items-stretch bg-slate-950"
    >
      <div
        id="taku-mobile-window"
        className="relative flex h-dvh w-full flex-col overflow-hidden bg-slate-100 text-slate-950"
      >
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
