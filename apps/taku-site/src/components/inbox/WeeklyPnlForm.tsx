"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMxn, parseNonNegativeNumber, parseQuantity } from "./raiseOrder";
import { Field, Input } from "./ui";
import {
  WEEK_COSTS_CHANGED_EVENT,
  computeWeekPnl,
  readCostCatalog,
  readWeekInputs,
  writeCostCatalog,
  writeWeekInputs,
  type WeekPnl,
} from "./weekCosts";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-slate-950">
        {value}
      </p>
    </div>
  );
}

function moneyText(value: number | null) {
  return value == null ? "—" : formatMxn(value);
}

function amountField(value: number) {
  return String(value);
}

export function WeeklyPnlForm({
  weekStart,
  ingresos,
  mojarrasVendidas,
  showIntro = true,
}: {
  weekStart: string;
  ingresos: number;
  mojarrasVendidas: number;
  showIntro?: boolean;
}) {
  const [pnl, setPnl] = useState<WeekPnl>(() =>
    computeWeekPnl({
      weekStart,
      ingresos,
      mojarrasVendidas,
    }),
  );
  const [bought, setBought] = useState("");
  const [mojarraKg, setMojarraKg] = useState("");
  const [kgCost, setKgCost] = useState("");
  const [aceite, setAceite] = useState("");
  const [raya, setRaya] = useState("");
  const [publi, setPubli] = useState("");
  const [comida, setComida] = useState("");
  const [otros, setOtros] = useState("");

  useEffect(() => {
    const catalog = readCostCatalog();
    const week = readWeekInputs(weekStart);
    setBought(week.mojarrasBought == null ? "" : String(week.mojarrasBought));
    setMojarraKg(String(catalog.mojarraKg));
    setKgCost(String(catalog.kgCost));
    setAceite(amountField(week.aceite));
    setRaya(amountField(week.raya));
    setPubli(amountField(week.publi));
    setComida(amountField(week.comidaVerduras));
    setOtros(amountField(week.otros));
  }, [weekStart]);

  useEffect(() => {
    const sync = () => {
      setPnl(
        computeWeekPnl({
          weekStart,
          ingresos,
          mojarrasVendidas,
        }),
      );
    };
    sync();
    window.addEventListener(WEEK_COSTS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(WEEK_COSTS_CHANGED_EVENT, sync);
  }, [weekStart, ingresos, mojarrasVendidas]);

  const hint = useMemo(() => {
    if (bought !== "") return undefined;
    if (mojarrasVendidas <= 0) return "Cuantas mojarras compraste esta semana.";
    return `Vendidas esta semana: ${mojarrasVendidas}`;
  }, [bought, mojarrasVendidas]);

  function persistBought(value: string) {
    setBought(value);
    writeWeekInputs(weekStart, {
      mojarrasBought: value.trim() === "" ? null : parseQuantity(value),
    });
  }

  return (
    <section className="grid gap-4 px-4 pb-4">
      {showIntro ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-950">
            Cierre de costos
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Costo mojarra = compradas × peso × precio/kg. Neto = ventas −
            gastos.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Ingresos" value={formatMxn(pnl.ingresos)} />
        <Stat label="Vendidas" value={String(pnl.mojarrasVendidas)} />
        <Stat label="Gastos" value={moneyText(pnl.gastos)} />
        <Stat
          label={
            pnl.neto == null ? "Neto" : pnl.neto < 0 ? "Perdida" : "Ganancia"
          }
          value={moneyText(pnl.neto)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Peso por mojarra (kg)">
          <Input
            type="number"
            min={0}
            step="0.1"
            inputMode="decimal"
            placeholder="0.7"
            value={mojarraKg}
            onChange={(value) => {
              setMojarraKg(value);
              writeCostCatalog({ mojarraKg: parseNonNegativeNumber(value) });
            }}
          />
        </Field>
        <Field label="Precio por kg">
          <Input
            type="number"
            min={0}
            step="1"
            inputMode="decimal"
            placeholder="95"
            value={kgCost}
            onChange={(value) => {
              setKgCost(value);
              writeCostCatalog({ kgCost: parseNonNegativeNumber(value) });
            }}
          />
        </Field>
      </div>

      <Field label="Mojarras compradas" hint={hint}>
        <Input
          type="number"
          min={0}
          step="1"
          inputMode="numeric"
          placeholder={mojarrasVendidas > 0 ? String(mojarrasVendidas) : "0"}
          value={bought}
          onChange={persistBought}
        />
      </Field>

      {pnl.mojarraCost != null ? (
        <p className="text-xs text-slate-500">
          Costo mojarras {formatMxn(pnl.mojarraCost)} · Platos{" "}
          {formatMxn(pnl.platos ?? 0)} · Gas {formatMxn(pnl.gas ?? 0)}
        </p>
      ) : (
        <p className="text-xs text-slate-500">
          Pon las mojarras compradas para calcular costo, platos y gas.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Aceite">
          <Input
            type="number"
            min={0}
            step="1"
            inputMode="decimal"
            placeholder="0"
            value={aceite}
            onChange={(value) => {
              setAceite(value);
              writeWeekInputs(weekStart, {
                aceite: parseNonNegativeNumber(value),
              });
            }}
          />
        </Field>
        <Field label="Raya">
          <Input
            type="number"
            min={0}
            step="1"
            inputMode="decimal"
            placeholder="2100"
            value={raya}
            onChange={(value) => {
              setRaya(value);
              writeWeekInputs(weekStart, {
                raya: parseNonNegativeNumber(value),
              });
            }}
          />
        </Field>
        <Field label="Publi">
          <Input
            type="number"
            min={0}
            step="1"
            inputMode="decimal"
            placeholder="1500"
            value={publi}
            onChange={(value) => {
              setPubli(value);
              writeWeekInputs(weekStart, {
                publi: parseNonNegativeNumber(value),
              });
            }}
          />
        </Field>
        <Field label="Comida y verduras">
          <Input
            type="number"
            min={0}
            step="1"
            inputMode="decimal"
            placeholder="500"
            value={comida}
            onChange={(value) => {
              setComida(value);
              writeWeekInputs(weekStart, {
                comidaVerduras: parseNonNegativeNumber(value),
              });
            }}
          />
        </Field>
      </div>
      <Field label="Otros">
        <Input
          type="number"
          min={0}
          step="1"
          inputMode="decimal"
          placeholder="0"
          value={otros}
          onChange={(value) => {
            setOtros(value);
            writeWeekInputs(weekStart, {
              otros: parseNonNegativeNumber(value),
            });
          }}
        />
      </Field>
    </section>
  );
}
