"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { TakuApiError } from "@/lib/taku-api";
import { fetchAttendancePunches, setWhatsAppTimeClock } from "./api";
import {
  clockEmployee,
  clockErrorMessage,
  isTimeClockEnabled,
  notifyWhatsAppAccountsChanged,
  type AttendancePunchRecord,
} from "./attendance";
import { formatTime } from "./helpers";
import { useInboxView } from "./inboxView";
import { todayOrderKey } from "./pendingOrders";
import type { InboxWhatsAppAccount } from "./types";
import { Button, Field, Input } from "./ui";

function closeHost() {
  return document.getElementById("taku-mobile-window") ?? document.body;
}

function punchLabel(type: AttendancePunchRecord["type"]) {
  return type === "entrada" ? "Entrada" : "Salida";
}

function accountLabel(account: InboxWhatsAppAccount) {
  return account.phoneNumber || account.displayName;
}

export function ChecadorPanel({
  account,
  onClose,
}: {
  account: InboxWhatsAppAccount;
  onClose: () => void;
}) {
  const view = useInboxView();
  const canManage = view === "owner";
  const [enabled, setEnabled] = useState(isTimeClockEnabled(account));
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [punch, setPunch] = useState<AttendancePunchRecord | null>(null);
  const [punches, setPunches] = useState<AttendancePunchRecord[]>([]);
  const dayKey = todayOrderKey();
  const todayPunches = useMemo(
    () => punches.filter((item) => item.dayKey === dayKey),
    [punches, dayKey],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchAttendancePunches(account.id)
      .then((rows) => {
        if (!cancelled) setPunches(rows);
      })
      .catch(() => {
        if (!cancelled) setPunches([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account.id]);

  const host = typeof document !== "undefined" ? closeHost() : null;
  if (!host) return null;

  async function toggleClock(next: boolean) {
    setSaving(true);
    setError(null);
    try {
      const updated = await setWhatsAppTimeClock(account.id, next);
      setEnabled(isTimeClockEnabled(updated));
      setPunch(null);
      notifyWhatsAppAccountsChanged();
    } catch (caught) {
      setError(
        caught instanceof TakuApiError
          ? caught.status === 403
            ? "Solo owner o admin puede activar el checador."
            : caught.message
          : "No se pudo actualizar el checador.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const recorded = await clockEmployee(
        phone,
        pin,
        {
          ...account,
          timeClockEnabled: enabled,
        },
        punches,
      );
      setPunch(recorded);
      setPunches((current) => [
        recorded,
        ...current.filter((item) => item.id !== recorded.id),
      ]);
      setPin("");
    } catch (caught) {
      setError(clockErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  const overlayClass =
    host.id === "taku-mobile-window"
      ? "absolute inset-0 z-[90] flex flex-col bg-white"
      : "fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4";

  const panel = (
    <div className={overlayClass}>
      <div
        className={
          host.id === "taku-mobile-window"
            ? "flex min-h-0 flex-1 flex-col"
            : "flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        }
      >
        <header className="flex items-center gap-2 border-b border-slate-200 px-2 py-3">
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center text-lg"
            aria-label="Cerrar"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-slate-950">
              Checador
            </h2>
            <p className="truncate text-xs text-slate-500">
              {accountLabel(account)}
              {enabled ? " · activo" : " · inactivo"}
            </p>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {!enabled ? (
            <div className="grid gap-4">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-950">
                  Este numero no tiene checador
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Activalo para guardar entradas y salidas de este negocio en la
                  base de datos.
                </p>
              </div>
              {error ? <p className="text-sm text-slate-700">{error}</p> : null}
              {canManage ? (
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    void toggleClock(true);
                  }}
                >
                  {saving ? "Activando..." : "Activar checador"}
                </Button>
              ) : (
                <p className="text-sm text-slate-500">
                  Pide a un owner que active el checador para este numero.
                </p>
              )}
            </div>
          ) : punch ? (
            <div className="grid gap-4">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {punchLabel(punch.type)} marcada
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {punch.employeeName}
                </p>
                <p className="mt-1 text-sm tabular-nums text-slate-700">
                  {formatTime(punch.createdAt)}
                </p>
              </div>
              <Button type="button" onClick={onClose}>
                Listo
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPunch(null);
                  setPhone("");
                  setPin("");
                  setError(null);
                }}
              >
                Marcar otra
              </Button>
            </div>
          ) : (
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <p className="text-xs text-slate-500">
                Una entrada y una salida por dia. Entrada desde las 8:59 a.m.
                Salida desde las 5:30 p.m.
              </p>
              <Field label="Numero">
                <Input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={15}
                  placeholder="9930000000"
                  value={phone}
                  onChange={setPhone}
                />
              </Field>
              <Field label="PIN">
                <Input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  placeholder="••••"
                  value={pin}
                  onChange={setPin}
                />
              </Field>
              {error ? <p className="text-sm text-slate-700">{error}</p> : null}
              <Button
                type="submit"
                disabled={
                  saving ||
                  phone.replace(/\D/g, "").length < 10 ||
                  pin.trim().length !== 4
                }
              >
                {saving ? "Marcando..." : "Marcar"}
              </Button>
            </form>
          )}

          {enabled ? (
            <div className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Hoy
              </p>
              {loading ? (
                <p className="mt-2 text-sm text-slate-500">Cargando...</p>
              ) : todayPunches.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  Aun no hay marcas en este numero.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200">
                  {todayPunches.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {item.employeeName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {punchLabel(item.type)}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm tabular-nums text-slate-700">
                        {formatTime(item.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {canManage ? (
                <div className="mt-6">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => {
                      void toggleClock(false);
                    }}
                  >
                    Desactivar checador
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(panel, host);
}
