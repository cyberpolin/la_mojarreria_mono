"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CheckOption } from "./CheckOption";
import {
  afterHoursLabel,
  DAY_NAMES,
  type OwnerBotSettings,
  type OwnerBusinessHours,
} from "./numberTypes";

function SectionCard({
  label,
  onOpen,
  children,
}: {
  label: string;
  onOpen: () => void;
  children?: ReactNode;
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 md:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      {children}
    </article>
  );
}

export function NumberSectionCards({
  accountId,
  settings,
  hours,
  onOpenHours,
}: {
  accountId: string;
  settings: OwnerBotSettings | null;
  hours: OwnerBusinessHours | null;
  onOpenHours: () => void;
}) {
  const afterHours = settings ? afterHoursLabel(settings) : "";
  const automationHref = `/owner/numbers/${accountId}/automation`;
  const automationItems = [
    {
      id: "automatizacion",
      label: "Automatizacion",
      checked: Boolean(settings?.enabled),
      href: automationHref,
    },
    {
      id: "reglas",
      label: "Reglas",
      checked: Boolean(settings?.rulesEnabled),
      href: `/owner/numbers/${accountId}/auto-replies`,
    },
    {
      id: "ia",
      label: "IA",
      checked: Boolean(settings?.aiEnabled),
      href: `${automationHref}#ia`,
    },
    {
      id: "fuera-de-horario",
      label: afterHours
        ? `Fuera de horario: ${afterHours}`
        : "Fuera de horario",
      checked: Boolean(settings?.afterHoursEnabled),
      href: `${automationHref}#fuera-de-horario`,
    },
  ];

  const openDays = (hours?.days ?? [])
    .slice()
    .sort((left, right) => left.dayOfWeek - right.dayOfWeek)
    .filter((day) => !day.isClosed && (day.opensAt || day.closesAt));

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article className="rounded-xl border border-slate-200 bg-white p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Automatizacion
        </p>
        <div className="mt-5 grid gap-1">
          {automationItems.map((item) => (
            <div
              key={item.id}
              className="flex min-h-11 items-center justify-between gap-3"
            >
              <CheckOption label={item.label} checked={item.checked} />
              <Link
                href={item.href}
                className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-slate-700 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              >
                Configurar
              </Link>
            </div>
          ))}
        </div>
      </article>

      <SectionCard label="Horario" onOpen={onOpenHours}>
        {openDays.length > 0 ? (
          <dl className="mt-5 grid gap-3">
            {openDays.map((day) => (
              <div key={day.dayOfWeek}>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {DAY_NAMES[day.dayOfWeek] ?? day.dayOfWeek}
                </dt>
                <dd className="mt-1 text-sm font-medium text-slate-950">
                  {day.opensAt} - {day.closesAt}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </SectionCard>
    </div>
  );
}
