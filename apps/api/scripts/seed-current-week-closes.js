const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const DEVICE_ID = "seed-weekly-001";
const PRODUCT_SEEDS = [
  { name: "Mojarra Frita", price: 15000, rawCost: 9000 },
  { name: "Empanada de Camaron", price: 10000, rawCost: 5500 },
  { name: "Empanada de Minilla", price: 10000, rawCost: 5000 },
];

const DAY_SEEDS = [
  { mojarras: 8, camaron: 5, minilla: 4, cash: 95000, transfer: 105000 },
  { mojarras: 10, camaron: 7, minilla: 6, cash: 125000, transfer: 125000 },
  { mojarras: 12, camaron: 8, minilla: 7, cash: 145000, transfer: 145000 },
  { mojarras: 15, camaron: 10, minilla: 9, cash: 185000, transfer: 150000 },
  { mojarras: 18, camaron: 14, minilla: 12, cash: 220000, transfer: 190000 },
  { mojarras: 24, camaron: 18, minilla: 14, cash: 300000, transfer: 240000 },
  { mojarras: 20, camaron: 16, minilla: 12, cash: 250000, transfer: 220000 },
];

const toDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const fromDateInput = (value) => new Date(`${value}T12:00:00`);

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getMonday = (date) => {
  const day = date.getDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
};

const getReferenceDate = () => {
  const raw = process.env.DUMMY_CLOSE_REFERENCE_DATE;
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return fromDateInput(raw);
  }

  return new Date();
};

async function ensureProducts() {
  const products = [];

  for (const seed of PRODUCT_SEEDS) {
    const existing = await prisma.product.findFirst({
      where: { name: seed.name },
      select: { id: true },
    });
    const product = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data: {
            price: seed.price,
            rawCost: seed.rawCost,
            active: true,
          },
          select: { id: true, name: true, price: true, rawCost: true },
        })
      : await prisma.product.create({
          data: {
            name: seed.name,
            price: seed.price,
            rawCost: seed.rawCost,
            active: true,
            description: "Seeded weekly dummy product.",
          },
          select: { id: true, name: true, price: true, rawCost: true },
        });
    products.push(product);
  }

  return new Map(products.map((product) => [product.name, product]));
}

async function upsertDailyClose({ date, daySeed, products }) {
  const items = [
    { product: products.get("Mojarra Frita"), qty: daySeed.mojarras },
    { product: products.get("Empanada de Camaron"), qty: daySeed.camaron },
    { product: products.get("Empanada de Minilla"), qty: daySeed.minilla },
  ].filter((item) => item.product);

  const totalFromItems = items.reduce(
    (sum, item) => sum + item.qty * item.product.price,
    0,
  );
  const cogsCents = items.reduce(
    (sum, item) => sum + item.qty * item.product.rawCost,
    0,
  );
  const grossProfitCents = totalFromItems - cogsCents;
  const deliveryCashPaid = 12000 + daySeed.camaron * 500;
  const otherCashExpenses = 8000 + daySeed.minilla * 400;
  const operatingProfitCents =
    grossProfitCents - deliveryCashPaid - otherCashExpenses;

  const existing = await prisma.dailyClose.findFirst({
    where: { deviceId: DEVICE_ID, date },
    select: { id: true },
  });

  const close = existing
    ? await prisma.dailyClose.update({
        where: { id: existing.id },
        data: {
          cashReceived: daySeed.cash,
          bankTransfersReceived: daySeed.transfer,
          deliveryCashPaid,
          otherCashExpenses,
          expectedTotal: totalFromItems,
          totalFromItems,
          cogsCents,
          grossProfitCents,
          grossMarginBps: Math.round(
            (grossProfitCents / totalFromItems) * 10000,
          ),
          allocatedFixedExpensesCents: 0,
          fixedExpenseRatioBps: 0,
          operatingProfitCents,
          operatingMarginBps: Math.round(
            (operatingProfitCents / totalFromItems) * 10000,
          ),
          costingWarnings: {},
          costingStatus: "COMPLETE",
          notes: "Dummy weekly close",
          status: "ACTIVE",
        },
      })
    : await prisma.dailyClose.create({
        data: {
          deviceId: DEVICE_ID,
          date,
          cashReceived: daySeed.cash,
          bankTransfersReceived: daySeed.transfer,
          deliveryCashPaid,
          otherCashExpenses,
          expectedTotal: totalFromItems,
          totalFromItems,
          cogsCents,
          grossProfitCents,
          grossMarginBps: Math.round(
            (grossProfitCents / totalFromItems) * 10000,
          ),
          allocatedFixedExpensesCents: 0,
          fixedExpenseRatioBps: 0,
          operatingProfitCents,
          operatingMarginBps: Math.round(
            (operatingProfitCents / totalFromItems) * 10000,
          ),
          costingWarnings: {},
          costingStatus: "COMPLETE",
          notes: "Dummy weekly close",
          status: "ACTIVE",
        },
      });

  await prisma.dailyCloseItem.deleteMany({
    where: { closeId: close.id },
  });

  await prisma.dailyCloseItem.createMany({
    data: items.map((item) => ({
      closeId: close.id,
      productId: item.product.id,
      name: item.product.name,
      price: item.product.price,
      qty: item.qty,
      subtotal: item.product.price * item.qty,
    })),
  });

  return close;
}

async function main() {
  const referenceDate = getReferenceDate();
  const weekStart = getMonday(referenceDate);
  const products = await ensureProducts();
  const results = [];

  for (let index = 0; index < DAY_SEEDS.length; index += 1) {
    const date = toDateInput(addDays(weekStart, index));
    const close = await upsertDailyClose({
      date,
      daySeed: DAY_SEEDS[index],
      products,
    });
    results.push({ id: close.id, date });
  }

  console.log(
    `Seeded ${results.length} dummy weekly closes from ${results[0].date} to ${
      results[results.length - 1].date
    } for ${DEVICE_ID}.`,
  );
}

main()
  .catch((error) => {
    console.error("Failed to seed dummy weekly closes:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
