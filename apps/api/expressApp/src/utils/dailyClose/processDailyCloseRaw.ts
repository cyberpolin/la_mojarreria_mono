import { DailyClosePayload } from "../../types/DailyClosePayload";
import { calcDailyCloseCosts } from "../costing/calcDailyCloseCosts";
import { calcRecurringFixedExpenses } from "../costing/calcRecurringFixedExpenses";

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

type ProcessArgs = {
  context: any;
  deviceId: string;
  payload: DailyClosePayload;
  rawId?: string;
};

export const processDailyCloseRaw = async ({
  context,
  deviceId,
  payload,
  rawId,
}: ProcessArgs) => {
  const closedByUserId = String(payload.closedByUserId ?? "").trim();
  let closingUser: { id: string; phone: string; name: string } | null = null;
  if (closedByUserId) {
    if (!isUuid(closedByUserId)) {
      throw new Error("Daily close payload has invalid closedByUserId.");
    }
    closingUser = await context.prisma.user.findFirst({
      where: { id: closedByUserId, active: true },
      select: { id: true, phone: true, name: true },
    });
    if (!closingUser) {
      throw new Error("Closing user not found or inactive.");
    }

    const payloadPhone = String(payload.closedByPhone ?? "").trim();
    if (payloadPhone && payloadPhone !== closingUser.phone) {
      throw new Error("Closing user phone does not match payload phone.");
    }
  }

  const normalizedItems = (payload.items ?? []).map((item) => {
    const qty = Number(item.qty ?? 0);
    const price = Number(item.price ?? 0);
    return {
      productId: String(item.productId ?? ""),
      name: String(item.name ?? item.productId ?? ""),
      qty,
      price,
      subtotal: Math.round(qty * price),
    };
  });

  const totalFromItems = normalizedItems.reduce(
    (sum, item) => sum + item.subtotal,
    0,
  );

  const close = await context.prisma.dailyClose.upsert({
    where: { date: payload.date },
    create: {
      deviceId,
      date: payload.date,
      cashReceived: Number(payload.cashReceived ?? 0),
      bankTransfersReceived: Number(payload.bankTransfersReceived ?? 0),
      deliveryCashPaid: Number(payload.deliveryCashPaid ?? 0),
      otherCashExpenses: Number(payload.otherCashExpenses ?? 0),
      expectedTotal: Number(payload.expectedTotal ?? totalFromItems),
      totalFromItems,
      notes: String(payload.notes ?? ""),
      status: "ACTIVE",
      sourceRawId: rawId ?? null,
      ...(closingUser?.id ? { closedById: closingUser.id } : {}),
    },
    update: {
      deviceId,
      cashReceived: Number(payload.cashReceived ?? 0),
      bankTransfersReceived: Number(payload.bankTransfersReceived ?? 0),
      deliveryCashPaid: Number(payload.deliveryCashPaid ?? 0),
      otherCashExpenses: Number(payload.otherCashExpenses ?? 0),
      expectedTotal: Number(payload.expectedTotal ?? totalFromItems),
      totalFromItems,
      notes: String(payload.notes ?? ""),
      status: "ACTIVE",
      sourceRawId: rawId ?? null,
      ...(closingUser?.id ? { closedById: closingUser.id } : {}),
    },
  });

  await context.prisma.dailyCloseItem.deleteMany({
    where: { closeId: close.id },
  });
  if (normalizedItems.length > 0) {
    await context.prisma.dailyCloseItem.createMany({
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
  const recipeProductIds = soldProductIds.filter(isUuid);

  const recipeRows =
    recipeProductIds.length > 0
      ? await context.prisma.productRecipeItem.findMany({
          where: {
            productId: { in: recipeProductIds },
          },
        })
      : [];

  const soldProducts =
    recipeProductIds.length > 0
      ? await context.prisma.product.findMany({
          where: {
            id: { in: recipeProductIds },
          },
          select: { id: true, name: true },
        })
      : [];
  const productNameById = new Map<string, string>(
    soldProducts.map((product: any) => [product.id, product.name]),
  );

  const rawMaterialIds = Array.from(
    new Set(recipeRows.map((item: any) => item.rawMaterialId)),
  );
  const rawMaterials =
    rawMaterialIds.length > 0
      ? await context.prisma.rawMaterial.findMany({
          where: {
            id: { in: rawMaterialIds },
          },
          select: { id: true, name: true },
        })
      : [];
  const rawMaterialNameById = new Map<string, string>(
    rawMaterials.map((material: any) => [material.id, material.name]),
  );

  const purchaseRows =
    rawMaterialIds.length > 0
      ? await context.prisma.rawMaterialPurchase.findMany({
          where: {
            rawMaterialId: { in: rawMaterialIds },
          },
          orderBy: [{ purchasedAt: "desc" }],
        })
      : [];

  const latestPurchaseByRawMaterial = new Map<string, any>();
  for (const purchase of purchaseRows) {
    if (!latestPurchaseByRawMaterial.has(purchase.rawMaterialId)) {
      latestPurchaseByRawMaterial.set(purchase.rawMaterialId, purchase);
    }
  }

  const costResult = calcDailyCloseCosts({
    soldItems: normalizedItems.map((item) => ({
      productId: item.productId,
      qty: item.qty,
      price: item.price,
    })),
    recipeItems: recipeRows.map((recipe: any) => ({
      productId: recipe.productId,
      rawMaterialId: recipe.rawMaterialId,
      qtyPerProduct: Number(recipe.qtyPerProduct ?? 0),
      wastePct: Number(recipe.wastePct ?? 0),
    })),
    lastUnitCosts: Array.from(latestPurchaseByRawMaterial.values()).map(
      (purchase: any) => ({
        rawMaterialId: purchase.rawMaterialId,
        unitCostCents: purchase.unitCostCents,
      }),
    ),
  });

  const grossProfitCents = totalFromItems - costResult.cogsCents;
  const grossMarginBps =
    totalFromItems > 0
      ? Math.round((grossProfitCents / totalFromItems) * 10000)
      : 0;
  const fixedExpenseRows = await context.prisma.fixedOperatingExpense.findMany({
    where: { active: true },
    orderBy: [{ name: "asc" }],
  });
  const fixedExpenseResult = calcRecurringFixedExpenses({
    salesTotalCents: totalFromItems,
    fixedExpenses: fixedExpenseRows.map((expense: any) => ({
      id: expense.id,
      name: expense.name,
      costCents: Number(expense.costCents ?? 0),
      renewalDays: Number(expense.renewalDays ?? 0),
      active: Boolean(expense.active),
    })),
  });
  const operatingProfitCents =
    grossProfitCents - fixedExpenseResult.allocatedFixedExpensesCents;
  const operatingMarginBps =
    totalFromItems > 0
      ? Math.round((operatingProfitCents / totalFromItems) * 10000)
      : 0;

  const missingRecipe = costResult.warnings.missingRecipe.map(
    (productId) => productNameById.get(productId) ?? productId,
  );
  const missingLastPrice = costResult.warnings.missingLastPrice.map(
    (rawMaterialId) => rawMaterialNameById.get(rawMaterialId) ?? rawMaterialId,
  );
  const costingWarnings = {
    missingRecipe,
    missingLastPrice,
  };
  const hasWarnings = missingRecipe.length > 0 || missingLastPrice.length > 0;

  await context.prisma.dailyClose.update({
    where: { id: close.id },
    data: {
      cogsCents: costResult.cogsCents,
      grossProfitCents,
      grossMarginBps,
      allocatedFixedExpensesCents:
        fixedExpenseResult.allocatedFixedExpensesCents,
      fixedExpenseRatioBps: fixedExpenseResult.fixedExpenseRatioBps,
      operatingProfitCents,
      operatingMarginBps,
      costingWarnings,
      costingStatus: hasWarnings ? "PARTIAL" : "COMPLETE",
    },
  });

  if (rawId) {
    await context.prisma.dailyCloseRaw.update({
      where: { id: rawId },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        errorMessage: null,
        normalizedClose: {
          connect: { id: close.id },
        },
      },
    });
  }

  return {
    closeId: close.id,
    cogsCents: costResult.cogsCents,
    grossProfitCents,
    grossMarginBps,
    allocatedFixedExpensesCents: fixedExpenseResult.allocatedFixedExpensesCents,
    fixedExpenseRatioBps: fixedExpenseResult.fixedExpenseRatioBps,
    operatingProfitCents,
    operatingMarginBps,
    costingWarnings,
  };
};
