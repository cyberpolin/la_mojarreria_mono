export const WEEK_COSTS_KEY = "MOJARRERIA_TAKU_WEEK_COSTS";
export const WEEK_COSTS_VERSION = 1;
export const WEEK_COSTS_CHANGED_EVENT = "mojarreria-week-costs-changed";
export const WEEK_CLOSES_CHANGED_EVENT = "mojarreria-week-closes-changed";

export const DEFAULT_MOJARRA_KG = 0.7;
export const DEFAULT_MOJARRA_KG_COST = 95;
export const DEFAULT_PLATOS_PER_MOJARRA = 3;
export const DEFAULT_GAS_PER_MOJARRA = 5;

export const DEFAULT_FIXED_COSTS = {
  aceite: 0,
  raya: 2100,
  publi: 1500,
  comidaVerduras: 500,
  otros: 0,
};

export type CostCatalog = {
  mojarraKg: number;
  kgCost: number;
  platosPerMojarra: number;
  gasPerMojarra: number;
};

export type WeekCloseInputs = {
  weekStart: string;
  mojarrasBought: number | null;
  aceite: number;
  raya: number;
  publi: number;
  comidaVerduras: number;
  otros: number;
};

export type WeekPnl = {
  ingresos: number;
  mojarrasVendidas: number;
  mojarrasBought: number | null;
  catalog: CostCatalog;
  mojarraCost: number | null;
  platos: number | null;
  gas: number | null;
  aceite: number;
  raya: number;
  publi: number;
  comidaVerduras: number;
  otros: number;
  gastos: number | null;
  neto: number | null;
};

type CostsPayload = {
  version: number;
  catalog: CostCatalog;
  weeks: WeekCloseInputs[];
};

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function asFinite(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeCatalog(
  value: Partial<CostCatalog> | null | undefined,
): CostCatalog {
  return {
    mojarraKg: asFinite(value?.mojarraKg, DEFAULT_MOJARRA_KG),
    kgCost: asFinite(value?.kgCost, DEFAULT_MOJARRA_KG_COST),
    platosPerMojarra: asFinite(
      value?.platosPerMojarra,
      DEFAULT_PLATOS_PER_MOJARRA,
    ),
    gasPerMojarra: asFinite(value?.gasPerMojarra, DEFAULT_GAS_PER_MOJARRA),
  };
}

function normalizeWeek(
  value: Partial<WeekCloseInputs>,
  weekStart: string,
): WeekCloseInputs {
  return {
    weekStart,
    mojarrasBought:
      value.mojarrasBought == null ? null : asFinite(value.mojarrasBought, 0),
    aceite: asFinite(value.aceite, DEFAULT_FIXED_COSTS.aceite),
    raya: asFinite(value.raya, DEFAULT_FIXED_COSTS.raya),
    publi: asFinite(value.publi, DEFAULT_FIXED_COSTS.publi),
    comidaVerduras: asFinite(
      value.comidaVerduras,
      DEFAULT_FIXED_COSTS.comidaVerduras,
    ),
    otros: asFinite(value.otros, DEFAULT_FIXED_COSTS.otros),
  };
}

function emptyPayload(): CostsPayload {
  return {
    version: WEEK_COSTS_VERSION,
    catalog: normalizeCatalog(null),
    weeks: [],
  };
}

function readPayload(): CostsPayload {
  if (!canUseStorage()) return emptyPayload();
  try {
    const raw = window.localStorage.getItem(WEEK_COSTS_KEY);
    if (!raw) return emptyPayload();
    const parsed = JSON.parse(raw) as Partial<CostsPayload>;
    const weeks = Array.isArray(parsed.weeks)
      ? parsed.weeks
          .filter((week) => week && typeof week.weekStart === "string")
          .map((week) => normalizeWeek(week, week.weekStart))
      : [];
    return {
      version: WEEK_COSTS_VERSION,
      catalog: normalizeCatalog(parsed.catalog),
      weeks,
    };
  } catch {
    return emptyPayload();
  }
}

function writePayload(payload: CostsPayload) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(WEEK_COSTS_KEY, JSON.stringify(payload));
  window.dispatchEvent(new Event(WEEK_COSTS_CHANGED_EVENT));
}

export function readCostCatalog() {
  return readPayload().catalog;
}

export function writeCostCatalog(patch: Partial<CostCatalog>) {
  const payload = readPayload();
  writePayload({
    ...payload,
    catalog: normalizeCatalog({ ...payload.catalog, ...patch }),
  });
}

function latestWeekBefore(weekStart: string, weeks: WeekCloseInputs[]) {
  return [...weeks]
    .filter((week) => week.weekStart < weekStart)
    .sort((left, right) => right.weekStart.localeCompare(left.weekStart))[0];
}

export function defaultWeekInputs(weekStart: string): WeekCloseInputs {
  const previous = latestWeekBefore(weekStart, readPayload().weeks);
  return {
    weekStart,
    mojarrasBought: null,
    aceite: previous?.aceite ?? DEFAULT_FIXED_COSTS.aceite,
    raya: previous?.raya ?? DEFAULT_FIXED_COSTS.raya,
    publi: previous?.publi ?? DEFAULT_FIXED_COSTS.publi,
    comidaVerduras:
      previous?.comidaVerduras ?? DEFAULT_FIXED_COSTS.comidaVerduras,
    otros: previous?.otros ?? DEFAULT_FIXED_COSTS.otros,
  };
}

export function readWeekInputs(weekStart: string) {
  return (
    readPayload().weeks.find((week) => week.weekStart === weekStart) ??
    defaultWeekInputs(weekStart)
  );
}

export function writeWeekInputs(
  weekStart: string,
  patch: Partial<Omit<WeekCloseInputs, "weekStart">>,
) {
  const payload = readPayload();
  const current = readWeekInputs(weekStart);
  const next = normalizeWeek({ ...current, ...patch }, weekStart);
  writePayload({
    ...payload,
    weeks: [
      next,
      ...payload.weeks.filter((week) => week.weekStart !== weekStart),
    ],
  });
  return next;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function mojarraPurchaseCost(
  bought: number,
  catalog: CostCatalog = readCostCatalog(),
) {
  return roundMoney(bought * catalog.mojarraKg * catalog.kgCost);
}

export function computeWeekPnl(input: {
  weekStart: string;
  ingresos: number;
  mojarrasVendidas: number;
  catalog?: CostCatalog;
  week?: WeekCloseInputs;
}): WeekPnl {
  const catalog = input.catalog ?? readCostCatalog();
  const week = input.week ?? readWeekInputs(input.weekStart);
  const bought = week.mojarrasBought;
  const mojarraCost =
    bought == null ? null : mojarraPurchaseCost(bought, catalog);
  const platos =
    bought == null ? null : roundMoney(bought * catalog.platosPerMojarra);
  const gas =
    bought == null ? null : roundMoney(bought * catalog.gasPerMojarra);
  const fixed = roundMoney(
    week.aceite + week.raya + week.publi + week.comidaVerduras + week.otros,
  );
  const gastos =
    mojarraCost == null || platos == null || gas == null
      ? null
      : roundMoney(mojarraCost + platos + gas + fixed);
  return {
    ingresos: roundMoney(input.ingresos),
    mojarrasVendidas: input.mojarrasVendidas,
    mojarrasBought: bought,
    catalog,
    mojarraCost,
    platos,
    gas,
    aceite: week.aceite,
    raya: week.raya,
    publi: week.publi,
    comidaVerduras: week.comidaVerduras,
    otros: week.otros,
    gastos,
    neto: gastos == null ? null : roundMoney(input.ingresos - gastos),
  };
}

export function applyWeekCloseLocal(close: {
  weekStart: string;
  mojarrasBought: number;
  mojarraKg: number;
  kgCost: number;
  platosPerMojarra: number;
  gasPerMojarra: number;
  aceite: number;
  raya: number;
  publi: number;
  comidaVerduras: number;
  otros: number;
}) {
  writeCostCatalog({
    mojarraKg: close.mojarraKg,
    kgCost: close.kgCost,
    platosPerMojarra: close.platosPerMojarra,
    gasPerMojarra: close.gasPerMojarra,
  });
  writeWeekInputs(close.weekStart, {
    mojarrasBought: close.mojarrasBought,
    aceite: close.aceite,
    raya: close.raya,
    publi: close.publi,
    comidaVerduras: close.comidaVerduras,
    otros: close.otros,
  });
}

export function notifyWeekClosesChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(WEEK_CLOSES_CHANGED_EVENT));
}
