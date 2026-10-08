"use client";

import type { ReactNode } from "react";
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
  settings,
  hours,
  onOpenAutomation,
  onOpenHours,
}: {
  settings: OwnerBotSettings | null;
  hours: OwnerBusinessHours | null;
  onOpenAutomation: () => void;
  onOpenHours: () => void;
}) {
  const afterHours = settings ? afterHoursLabel(settings) : "";
  const automationItems = [
    { label: "Automatizacion", checked: Boolean(settings?.enabled) },
    { label: "Reglas", checked: Boolean(settings?.rulesEnabled) },
    { label: "IA", checked: Boolean(settings?.aiEnabled) },
    {
      label: afterHours
        ? `Fuera de horario: ${afterHours}`
        : "Fuera de horario",
      checked: Boolean(settings?.afterHoursEnabled),
    },
  ];

  const openDays = (hours?.days ?? [])
    .slice()
    .sort((left, right) => left.dayOfWeek - right.dayOfWeek)
    .filter((day) => !day.isClosed && (day.opensAt || day.closesAt));

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <SectionCard label="Automatizacion" onOpen={onOpenAutomation}>
        <div className="mt-5 grid gap-1">
          {automationItems.map((item) => (
            <CheckOption
              key={item.label}
              label={item.label}
              checked={item.checked}
            />
          ))}
        </div>
      </SectionCard>

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
