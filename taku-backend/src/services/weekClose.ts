const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function addDateKey(dayKey: string, amount: number) {
  const match = DATE_KEY.exec(dayKey);
  if (!match) return null;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + amount),
  );
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isMondayDateKey(dayKey: string) {
  const match = DATE_KEY.exec(dayKey);
  if (!match) return false;
  return (
    new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    ).getUTCDay() === 1
  );
}

export function todayDateKey(now: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function weekEndFromStart(weekStart: string) {
  return addDateKey(weekStart, 6);
}

export function isPastWeek(weekStart: string, now: Date, timeZone: string) {
  const weekEnd = weekEndFromStart(weekStart);
  if (!weekEnd) return false;
  return todayDateKey(now, timeZone) > weekEnd;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function computeWeekCloseTotals(input: {
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
  ingresos: number;
}) {
  const mojarraCost = roundMoney(
    input.mojarrasBought * input.mojarraKg * input.kgCost,
  );
  const platos = roundMoney(input.mojarrasBought * input.platosPerMojarra);
  const gas = roundMoney(input.mojarrasBought * input.gasPerMojarra);
  const gastos = roundMoney(
    mojarraCost +
      platos +
      gas +
      input.aceite +
      input.raya +
      input.publi +
      input.comidaVerduras +
      input.otros,
  );
  return {
    mojarraCost,
    platos,
    gas,
    gastos,
    neto: roundMoney(input.ingresos - gastos),
  };
}
