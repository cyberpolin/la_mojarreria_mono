const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const SUPERADMIN_EMAIL = "cyberpolin@gmail.com";
const SUPERADMIN_PASSWORD = "changeme";
const SUPERADMIN_USER_ID = "11111111-1111-4111-8111-111111111111";
const SUPERADMIN_NAME = "Super Admin";
const SUPERADMIN_PHONE = "521999999999";
const SUPERADMIN_PIN = process.env.SUPERADMIN_PIN || "1234";

const PRODUCT_SEEDS = [
  {
    name: "Mojarra Frita",
    price: 150,
    rawCost: 90,
    description: "Mojarra frita completa.",
    images: [
      {
        publicId: "seed/mojarra-frita/cover",
        secureUrl:
          "https://res.cloudinary.com/demo/image/upload/v1/samples/food/fish-vegetables.jpg",
      },
    ],
  },
  {
    name: "Empanada de Camaron",
    price: 100,
    rawCost: 55,
    description: "Empanada rellena de camaron.",
    images: [
      {
        publicId: "seed/empanada-camaron/cover",
        secureUrl:
          "https://res.cloudinary.com/demo/image/upload/v1/samples/food/spices.jpg",
      },
    ],
  },
  {
    name: "Empanada de Minilla",
    price: 100,
    rawCost: 50,
    description: "Empanada rellena de minilla.",
    images: [
      {
        publicId: "seed/empanada-minilla/cover",
        secureUrl:
          "https://res.cloudinary.com/demo/image/upload/v1/samples/food/dessert.jpg",
      },
    ],
  },
];

const RAW_MATERIAL_SEEDS = [
  { name: "Mojarra Entera", unit: "kg", quantity: 12, totalCostCents: 144000 },
  { name: "Masa Empanada", unit: "kg", quantity: 20, totalCostCents: 60000 },
  { name: "Camaron", unit: "kg", quantity: 8, totalCostCents: 96000 },
  { name: "Minilla", unit: "kg", quantity: 8, totalCostCents: 72000 },
  { name: "Aceite", unit: "l", quantity: 15, totalCostCents: 45000 },
];

const RECIPE_SEEDS = [
  {
    productName: "Mojarra Frita",
    materialName: "Mojarra Entera",
    qtyPerProduct: 0.45,
    wastePct: 5,
  },
  {
    productName: "Mojarra Frita",
    materialName: "Aceite",
    qtyPerProduct: 0.05,
    wastePct: 8,
  },
  {
    productName: "Empanada de Camaron",
    materialName: "Masa Empanada",
    qtyPerProduct: 0.14,
    wastePct: 3,
  },
  {
    productName: "Empanada de Camaron",
    materialName: "Camaron",
    qtyPerProduct: 0.08,
    wastePct: 6,
  },
  {
    productName: "Empanada de Minilla",
    materialName: "Masa Empanada",
    qtyPerProduct: 0.14,
    wastePct: 3,
  },
  {
    productName: "Empanada de Minilla",
    materialName: "Minilla",
    qtyPerProduct: 0.09,
    wastePct: 6,
  },
];

const FIXED_EXPENSE_SEEDS = [
  {
    name: "Gas Cilindro",
    costCents: 420000,
    renewalDays: 30,
    notes: "Gasto operativo estimado para cocina.",
  },
  {
    name: "Jabon y Limpieza",
    costCents: 95000,
    renewalDays: 21,
    notes: "Limpieza general del local.",
  },
  {
    name: "Desechables",
    costCents: 180000,
    renewalDays: 20,
    notes: "Bolsas, contenedores y servilletas.",
  },
];

async function seedSuperAdmin() {
  const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);

  await prisma.user.upsert({
    where: { id: SUPERADMIN_USER_ID },
    update: {
      name: SUPERADMIN_NAME,
      phone: SUPERADMIN_PHONE,
      role: "ADMIN",
      active: true,
    },
    create: {
      id: SUPERADMIN_USER_ID,
      name: SUPERADMIN_NAME,
      phone: SUPERADMIN_PHONE,
      role: "ADMIN",
      active: true,
    },
  });

  await prisma.auth.upsert({
    where: { email: SUPERADMIN_EMAIL },
    update: {
      password: hashedPassword,
      userId: SUPERADMIN_USER_ID,
      pin: SUPERADMIN_PIN,
    },
    create: {
      email: SUPERADMIN_EMAIL,
      password: hashedPassword,
      userId: SUPERADMIN_USER_ID,
      pin: SUPERADMIN_PIN,
    },
  });
}

async function seedDailyCloseRaw() {
  await prisma.dailyCloseItem.deleteMany({
    where: {
      close: {
        is: {
          deviceId: { startsWith: "seed-device-" },
        },
      },
    },
  });

  await prisma.dailyClose.deleteMany({
    where: { deviceId: { startsWith: "seed-device-" } },
  });

  await prisma.dailyCloseRaw.deleteMany({
    where: { deviceId: { startsWith: "seed-device-" } },
  });

  const seededProducts = await prisma.product.findMany({
    where: { name: { in: PRODUCT_SEEDS.map((product) => product.name) } },
    select: { id: true, name: true, price: true },
  });

  const byName = new Map(
    seededProducts.map((product) => [product.name, product]),
  );

  await prisma.dailyCloseRaw.createMany({
    data: [
      {
        deviceId: "seed-device-001",
        date: "2026-02-24",
        payload: {
          date: "2026-02-24",
          items: [
            {
              productId:
                byName.get("Mojarra Frita")?.id ?? "seed-mojarra-frita",
              name: "Mojarra Frita",
              qty: 2,
              price: 15000,
            },
            {
              productId:
                byName.get("Empanada de Camaron")?.id ?? "seed-emp-camaron",
              name: "Empanada de Camaron",
              qty: 2,
              price: 10000,
            },
          ],
          cashReceived: 50000,
          bankTransfersReceived: 5000,
          deliveryCashPaid: 3000,
          otherCashExpenses: 1000,
          notes: "seeded raw close #1",
          expectedTotal: 50000,
          createdAt: new Date("2026-02-24T22:00:00.000Z").toISOString(),
        },
        status: "RECEIVED",
        notes: "dev seed 1",
      },
      {
        deviceId: "seed-device-002",
        date: "2026-02-25",
        payload: {
          date: "2026-02-25",
          items: [
            {
              productId:
                byName.get("Empanada de Camaron")?.id ?? "seed-emp-camaron",
              name: "Empanada de Camaron",
              qty: 4,
              price: 10000,
            },
            {
              productId:
                byName.get("Empanada de Minilla")?.id ?? "seed-emp-minilla",
              name: "Empanada de Minilla",
              qty: 3,
              price: 10000,
            },
          ],
          cashReceived: 22000,
          bankTransfersReceived: 50000,
          deliveryCashPaid: 8000,
          otherCashExpenses: 3500,
          notes: "seeded raw close #2",
          expectedTotal: 70000,
          createdAt: new Date("2026-02-25T22:00:00.000Z").toISOString(),
        },
        status: "RECEIVED",
        notes: "dev seed 2",
      },
    ],
  });
}

async function seedProducts() {
  for (const seed of PRODUCT_SEEDS) {
    const existing = await prisma.product.findFirst({
      where: { name: seed.name },
      select: { id: true },
    });

    if (existing?.id) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          price: seed.price,
          rawCost: seed.rawCost,
          description: seed.description,
          timeProcess: "30",
          images: seed.images,
          active: true,
        },
      });
      continue;
    }

    await prisma.product.create({
      data: {
        name: seed.name,
        price: seed.price,
        rawCost: seed.rawCost,
        description: seed.description,
        timeProcess: "30",
        images: seed.images,
        active: true,
      },
    });
  }
}

async function seedCostCatalog() {
  const materialsByName = new Map();
  const existingMaterials = await prisma.rawMaterial.findMany({
    where: { name: { in: RAW_MATERIAL_SEEDS.map((item) => item.name) } },
    select: { id: true },
  });
  if (existingMaterials.length > 0) {
    await prisma.rawMaterialPurchase.deleteMany({
      where: {
        rawMaterialId: { in: existingMaterials.map((item) => item.id) },
      },
    });
  }

  for (const seed of RAW_MATERIAL_SEEDS) {
    const material = await prisma.rawMaterial.upsert({
      where: { name: seed.name },
      update: { unit: seed.unit, active: true },
      create: { name: seed.name, unit: seed.unit, active: true },
      select: { id: true, name: true },
    });
    materialsByName.set(material.name, material);

    const unitCostCents =
      seed.quantity > 0 ? Math.round(seed.totalCostCents / seed.quantity) : 0;
    await prisma.rawMaterialPurchase.create({
      data: {
        rawMaterialId: material.id,
        purchasedAt: new Date("2026-02-23T12:00:00.000Z"),
        quantity: seed.quantity,
        totalCostCents: seed.totalCostCents,
        unitCostCents,
        supplier: "Seed Supplier",
        notes: "Dev seed purchase",
      },
    });
  }

  const products = await prisma.product.findMany({
    where: { name: { in: PRODUCT_SEEDS.map((item) => item.name) } },
    select: { id: true, name: true },
  });
  const productsByName = new Map(products.map((item) => [item.name, item]));

  await prisma.productRecipeItem.deleteMany({
    where: {
      productId: { in: products.map((item) => item.id) },
    },
  });

  for (const recipe of RECIPE_SEEDS) {
    const product = productsByName.get(recipe.productName);
    const material = materialsByName.get(recipe.materialName);
    if (!product || !material) continue;

    await prisma.productRecipeItem.create({
      data: {
        productId: product.id,
        rawMaterialId: material.id,
        qtyPerProduct: recipe.qtyPerProduct,
        wastePct: recipe.wastePct,
      },
    });
  }
}

async function seedFixedExpenses() {
  for (const seed of FIXED_EXPENSE_SEEDS) {
    await prisma.fixedOperatingExpense.upsert({
      where: { name: seed.name },
      update: {
        costCents: seed.costCents,
        renewalDays: seed.renewalDays,
        notes: seed.notes,
        active: true,
      },
      create: {
        name: seed.name,
        costCents: seed.costCents,
        renewalDays: seed.renewalDays,
        notes: seed.notes,
        active: true,
      },
    });
  }
}

function normalizeItems(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.sales)) {
    return payload.sales.map((item) => ({
      productId: item.productId,
      name: item.name ?? item.productId,
      qty: Number(item.qty ?? 0),
      price: Number(item.price ?? 0),
    }));
  }
  return [];
}

async function processRawToNormalizedClose() {
  const raws = await prisma.dailyCloseRaw.findMany({
    where: {
      deviceId: { startsWith: "seed-device-" },
      status: "RECEIVED",
    },
    orderBy: { receivedAt: "asc" },
  });

  for (const raw of raws) {
    try {
      const payload = raw.payload ?? {};
      const items = normalizeItems(payload);
      const normalizedItems = items.map((item) => ({
        productId: String(item.productId ?? ""),
        name: String(item.name ?? ""),
        qty: Number(item.qty ?? 0),
        price: Number(item.price ?? 0),
        subtotal: Number(item.qty ?? 0) * Number(item.price ?? 0),
      }));

      const totalFromItems = normalizedItems.reduce(
        (sum, item) => sum + item.subtotal,
        0,
      );

      const close = await prisma.dailyClose.upsert({
        where: { date: raw.date },
        create: {
          deviceId: raw.deviceId,
          date: raw.date,
          cashReceived: Number(payload.cashReceived ?? 0),
          bankTransfersReceived: Number(payload.bankTransfersReceived ?? 0),
          deliveryCashPaid: Number(payload.deliveryCashPaid ?? 0),
          otherCashExpenses: Number(payload.otherCashExpenses ?? 0),
          expectedTotal: Number(payload.expectedTotal ?? totalFromItems),
          totalFromItems,
          cogsCents: 0,
          grossProfitCents: totalFromItems,
          grossMarginBps: 10000,
          costingStatus: "PENDING",
          costingWarnings: null,
          notes: String(payload.notes ?? raw.notes ?? ""),
          status: "ACTIVE",
          sourceRawId: raw.id,
        },
        update: {
          deviceId: raw.deviceId,
          cashReceived: Number(payload.cashReceived ?? 0),
          bankTransfersReceived: Number(payload.bankTransfersReceived ?? 0),
          deliveryCashPaid: Number(payload.deliveryCashPaid ?? 0),
          otherCashExpenses: Number(payload.otherCashExpenses ?? 0),
          expectedTotal: Number(payload.expectedTotal ?? totalFromItems),
          totalFromItems,
          cogsCents: 0,
          grossProfitCents: totalFromItems,
          grossMarginBps: 10000,
          costingStatus: "PENDING",
          costingWarnings: null,
          notes: String(payload.notes ?? raw.notes ?? ""),
          status: "ACTIVE",
          sourceRawId: raw.id,
        },
      });

      await prisma.dailyCloseItem.deleteMany({ where: { closeId: close.id } });

      if (normalizedItems.length > 0) {
        await prisma.dailyCloseItem.createMany({
          data: normalizedItems.map((item) => ({
            closeId: close.id,
            productId: item.productId,
            name: item.name,
            qty: item.qty,
            price: item.price,
            subtotal: item.subtotal,
          })),
        });
      }

      const soldProductIds = Array.from(
        new Set(normalizedItems.map((item) => item.productId)),
      );
      const recipeRows =
        soldProductIds.length > 0
          ? await prisma.productRecipeItem.findMany({
              where: { productId: { in: soldProductIds } },
            })
          : [];

      const recipeByProduct = new Map();
      for (const row of recipeRows) {
        const list = recipeByProduct.get(row.productId) ?? [];
        list.push(row);
        recipeByProduct.set(row.productId, list);
      }

      const recipeRawMaterialIds = Array.from(
        new Set(recipeRows.map((item) => item.rawMaterialId)),
      );
      const purchases =
        recipeRawMaterialIds.length > 0
          ? await prisma.rawMaterialPurchase.findMany({
              where: { rawMaterialId: { in: recipeRawMaterialIds } },
              orderBy: [{ purchasedAt: "desc" }],
            })
          : [];

      const unitCostByMaterial = new Map();
      for (const purchase of purchases) {
        if (!unitCostByMaterial.has(purchase.rawMaterialId)) {
          unitCostByMaterial.set(
            purchase.rawMaterialId,
            Number(purchase.unitCostCents ?? 0),
          );
        }
      }

      let cogsCents = 0;
      const missingRecipe = new Set();
      const missingLastPrice = new Set();

      for (const sold of normalizedItems) {
        const recipeItems = recipeByProduct.get(sold.productId) ?? [];
        if (recipeItems.length === 0) {
          missingRecipe.add(sold.name || sold.productId);
          continue;
        }

        for (const recipe of recipeItems) {
          const unitCostCents = unitCostByMaterial.get(recipe.rawMaterialId);
          if (unitCostCents === undefined) {
            missingLastPrice.add(recipe.rawMaterialId);
            continue;
          }
          const effectiveQty =
            Number(sold.qty ?? 0) *
            Number(recipe.qtyPerProduct ?? 0) *
            (1 + Number(recipe.wastePct ?? 0) / 100);
          cogsCents += Math.round(effectiveQty * unitCostCents);
        }
      }

      const grossProfitCents = totalFromItems - cogsCents;
      const grossMarginBps =
        totalFromItems > 0
          ? Math.round((grossProfitCents / totalFromItems) * 10000)
          : 0;
      const fixedExpenses = await prisma.fixedOperatingExpense.findMany({
        where: { active: true },
      });
      const allocatedFixedExpensesCents = fixedExpenses.reduce((sum, item) => {
        if (Number(item.renewalDays ?? 0) <= 0) return sum;
        return (
          sum +
          Math.round(
            Number(item.costCents ?? 0) / Number(item.renewalDays ?? 0),
          )
        );
      }, 0);
      const fixedExpenseRatioBps =
        totalFromItems > 0
          ? Math.round((allocatedFixedExpensesCents / totalFromItems) * 10000)
          : 0;
      const operatingProfitCents =
        grossProfitCents - allocatedFixedExpensesCents;
      const operatingMarginBps =
        totalFromItems > 0
          ? Math.round((operatingProfitCents / totalFromItems) * 10000)
          : 0;
      const costingWarnings = {
        missingRecipe: Array.from(missingRecipe),
        missingLastPrice: Array.from(missingLastPrice),
      };
      const hasWarnings =
        costingWarnings.missingRecipe.length > 0 ||
        costingWarnings.missingLastPrice.length > 0;

      await prisma.dailyClose.update({
        where: { id: close.id },
        data: {
          cogsCents,
          grossProfitCents,
          grossMarginBps,
          allocatedFixedExpensesCents,
          fixedExpenseRatioBps,
          operatingProfitCents,
          operatingMarginBps,
          costingStatus: hasWarnings ? "PARTIAL" : "COMPLETE",
          costingWarnings: hasWarnings ? costingWarnings : null,
        },
      });

      await prisma.dailyCloseRaw.update({
        where: { id: raw.id },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
          errorMessage: null,
          normalizedClose: {
            connect: { id: close.id },
          },
        },
      });
    } catch (error) {
      await prisma.dailyCloseRaw.update({
        where: { id: raw.id },
        data: {
          status: "FAILED",
          processedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
}

async function seedSyncLogs() {
  await prisma.syncLog.deleteMany({
    where: { deviceId: { startsWith: "seed-device-" } },
  });

  await prisma.syncLog.createMany({
    data: [
      {
        type: "SYNC_DAILY_CLOSE",
        status: "FAILED",
        deviceId: "seed-device-001",
        date: "2026-02-24",
        rawId: "seed-raw-001",
        errorMessage: "Timeout while syncing DailyCloseRaw to backend",
        payloadSnapshot: { source: "mobile", step: "syncDailyCloses" },
        retryCount: 0,
      },
      {
        type: "SYNC_DAILY_CLOSE",
        status: "FAILED",
        deviceId: "seed-device-002",
        date: "2026-02-25",
        rawId: "seed-raw-002",
        errorMessage: "Validation error in processDailyCloseRaw",
        payloadSnapshot: { source: "api", step: "processDailyCloseRaw" },
        retryCount: 0,
      },
    ],
  });
}

async function seedTeamControl() {
  const employee = await prisma.user.upsert({
    where: { phone: "521000000001" },
    update: {
      name: "Empleado Demo",
      role: "ASSISTANT",
      active: true,
    },
    create: {
      name: "Empleado Demo",
      phone: "521000000001",
      role: "ASSISTANT",
      active: true,
    },
  });

  await prisma.auth.upsert({
    where: { email: "empleado.demo@mojarreria.local" },
    update: {
      pin: "1234",
      userId: employee.id,
    },
    create: {
      email: "empleado.demo@mojarreria.local",
      password: await bcrypt.hash("changeme", 10),
      pin: "1234",
      userId: employee.id,
    },
  });

  const existingSchedule = await prisma.employeeSchedule.findFirst({
    where: { userId: employee.id },
    select: { id: true },
  });

  if (existingSchedule?.id) {
    await prisma.employeeSchedule.update({
      where: { id: existingSchedule.id },
      data: {
        days: ["Fri", "Sat", "Sun"],
        shiftStart: "10:00",
        shiftEnd: "18:00",
        breakMinutes: 30,
        active: true,
      },
    });
  } else {
    await prisma.employeeSchedule.create({
      data: {
        userId: employee.id,
        days: ["Fri", "Sat", "Sun"],
        shiftStart: "10:00",
        shiftEnd: "18:00",
        breakMinutes: 30,
        active: true,
      },
    });
  }
}

async function main() {
  await seedSuperAdmin();
  await seedProducts();
  await seedCostCatalog();
  await seedFixedExpenses();
  await seedDailyCloseRaw();
  await processRawToNormalizedClose();
  await seedSyncLogs();
  await seedTeamControl();
  console.log("Development seed completed.");
  console.log(`Super admin: ${SUPERADMIN_EMAIL} / ${SUPERADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Development seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
