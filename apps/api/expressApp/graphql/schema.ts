// keystone.ts (o donde exportas config)
import { graphql } from "@keystone-6/core";
import { upsertDailyCloseRaw } from "./mutations/dailyClose";

// TODO: change name from properextendGraphqlSchema to extendGraphqlSchema after merging
export const properextendGraphqlSchema = graphql.extend((base) => {
  const DailyCloseItemMetric = graphql.object<{
    id: string;
    productId: string;
    name: string;
    qty: number;
    price: number;
    subtotal: number;
  }>()({
    name: "DailyCloseItemMetric",
    fields: {
      id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
      productId: graphql.field({ type: graphql.nonNull(graphql.String) }),
      name: graphql.field({ type: graphql.nonNull(graphql.String) }),
      qty: graphql.field({ type: graphql.nonNull(graphql.Int) }),
      price: graphql.field({ type: graphql.nonNull(graphql.Int) }),
      subtotal: graphql.field({ type: graphql.nonNull(graphql.Int) }),
    },
  });

  const SyncStatusInfo = graphql.object<{
    date: string;
    deviceId: string;
    syncStatus: string;
    syncedAt: string | null;
    lastSyncAttemptAt: string | null;
    hasSyncFailure: boolean;
    lastErrorMessage: string | null;
  }>()({
    name: "SyncStatusInfo",
    fields: {
      date: graphql.field({ type: graphql.nonNull(graphql.String) }),
      deviceId: graphql.field({ type: graphql.nonNull(graphql.String) }),
      syncStatus: graphql.field({ type: graphql.nonNull(graphql.String) }),
      syncedAt: graphql.field({ type: graphql.String }),
      lastSyncAttemptAt: graphql.field({ type: graphql.String }),
      hasSyncFailure: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
      lastErrorMessage: graphql.field({ type: graphql.String }),
    },
  });

  const DailyCloseDashboard = graphql.object<{
    id: string;
    date: string;
    deviceId: string;
    cashReceived: number;
    bankTransfersReceived: number;
    deliveryCashPaid: number;
    otherCashExpenses: number;
    expectedTotal: number;
    totalFromItems: number;
    cogsCents: number;
    grossProfitCents: number;
    grossMarginBps: number;
    allocatedFixedExpensesCents: number;
    fixedExpenseRatioBps: number;
    operatingProfitCents: number;
    operatingMarginBps: number;
    costingStatus: string;
    costingWarnings: Record<string, unknown> | null;
    notes: string;
    status: string;
    syncedAt: string | null;
    syncStatus: string;
    lastSyncAttemptAt: string | null;
    lastSyncErrorMessage: string | null;
    items: Array<{
      id: string;
      productId: string;
      name: string;
      qty: number;
      price: number;
      subtotal: number;
    }>;
  }>()({
    name: "DailyCloseDashboard",
    fields: {
      id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
      date: graphql.field({ type: graphql.nonNull(graphql.String) }),
      deviceId: graphql.field({ type: graphql.nonNull(graphql.String) }),
      cashReceived: graphql.field({ type: graphql.nonNull(graphql.Int) }),
      bankTransfersReceived: graphql.field({
        type: graphql.nonNull(graphql.Int),
      }),
      deliveryCashPaid: graphql.field({ type: graphql.nonNull(graphql.Int) }),
      otherCashExpenses: graphql.field({ type: graphql.nonNull(graphql.Int) }),
      expectedTotal: graphql.field({ type: graphql.nonNull(graphql.Int) }),
      totalFromItems: graphql.field({ type: graphql.nonNull(graphql.Int) }),
      cogsCents: graphql.field({ type: graphql.nonNull(graphql.Int) }),
      grossProfitCents: graphql.field({ type: graphql.nonNull(graphql.Int) }),
      grossMarginBps: graphql.field({ type: graphql.nonNull(graphql.Int) }),
      allocatedFixedExpensesCents: graphql.field({
        type: graphql.nonNull(graphql.Int),
      }),
      fixedExpenseRatioBps: graphql.field({
        type: graphql.nonNull(graphql.Int),
      }),
      operatingProfitCents: graphql.field({
        type: graphql.nonNull(graphql.Int),
      }),
      operatingMarginBps: graphql.field({
        type: graphql.nonNull(graphql.Int),
      }),
      costingStatus: graphql.field({ type: graphql.nonNull(graphql.String) }),
      costingWarnings: graphql.field({
        type: graphql.JSON,
        resolve(item) {
          return item.costingWarnings ?? null;
        },
      }),
      notes: graphql.field({ type: graphql.nonNull(graphql.String) }),
      status: graphql.field({ type: graphql.nonNull(graphql.String) }),
      syncedAt: graphql.field({ type: graphql.String }),
      syncStatus: graphql.field({ type: graphql.nonNull(graphql.String) }),
      lastSyncAttemptAt: graphql.field({ type: graphql.String }),
      lastSyncErrorMessage: graphql.field({ type: graphql.String }),
      items: graphql.field({
        type: graphql.nonNull(
          graphql.list(graphql.nonNull(DailyCloseItemMetric)),
        ),
      }),
    },
  });

  const RecentDailyCloseSummary = graphql.object<{
    id: string;
    date: string;
    deviceId: string;
    totalFromItems: number;
    moneyIn: number;
    moneyOut: number;
    syncStatus: string;
    syncedAt: string | null;
    status: string;
  }>()({
    name: "RecentDailyCloseSummary",
    fields: {
      id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
      date: graphql.field({ type: graphql.nonNull(graphql.String) }),
      deviceId: graphql.field({ type: graphql.nonNull(graphql.String) }),
      totalFromItems: graphql.field({ type: graphql.nonNull(graphql.Int) }),
      moneyIn: graphql.field({ type: graphql.nonNull(graphql.Int) }),
      moneyOut: graphql.field({ type: graphql.nonNull(graphql.Int) }),
      syncStatus: graphql.field({ type: graphql.nonNull(graphql.String) }),
      syncedAt: graphql.field({ type: graphql.String }),
      status: graphql.field({ type: graphql.nonNull(graphql.String) }),
    },
  });

  const WeeklyProductBaseline = graphql.object<{
    productId: string;
    name: string;
    avgQty: number;
    avgSales: number;
    sampleDays: number;
  }>()({
    name: "WeeklyProductBaseline",
    fields: {
      productId: graphql.field({ type: graphql.nonNull(graphql.String) }),
      name: graphql.field({ type: graphql.nonNull(graphql.String) }),
      avgQty: graphql.field({ type: graphql.nonNull(graphql.Float) }),
      avgSales: graphql.field({ type: graphql.nonNull(graphql.Float) }),
      sampleDays: graphql.field({ type: graphql.nonNull(graphql.Int) }),
    },
  });

  const ProductOperationalReportRow = graphql.object<{
    productId: string;
    name: string;
    price: number;
    rawCost: number;
    soldQty: number;
    soldSales: number;
    avgDailyQty: number;
    avgDailySales: number;
    estimatedGrossProfit: number;
    marginPercent: number;
  }>()({
    name: "ProductOperationalReportRow",
    fields: {
      productId: graphql.field({ type: graphql.nonNull(graphql.String) }),
      name: graphql.field({ type: graphql.nonNull(graphql.String) }),
      price: graphql.field({ type: graphql.nonNull(graphql.Float) }),
      rawCost: graphql.field({ type: graphql.nonNull(graphql.Float) }),
      soldQty: graphql.field({ type: graphql.nonNull(graphql.Int) }),
      soldSales: graphql.field({ type: graphql.nonNull(graphql.Int) }),
      avgDailyQty: graphql.field({ type: graphql.nonNull(graphql.Float) }),
      avgDailySales: graphql.field({ type: graphql.nonNull(graphql.Float) }),
      estimatedGrossProfit: graphql.field({
        type: graphql.nonNull(graphql.Float),
      }),
      marginPercent: graphql.field({ type: graphql.nonNull(graphql.Float) }),
    },
  });

  const DailyCloseOperatorValidationResult = graphql.object<{
    success: boolean;
    message: string;
    userId: string | null;
    name: string | null;
    phone: string | null;
    role: string | null;
  }>()({
    name: "DailyCloseOperatorValidationResult",
    fields: {
      success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
      message: graphql.field({ type: graphql.nonNull(graphql.String) }),
      userId: graphql.field({ type: graphql.String }),
      name: graphql.field({ type: graphql.String }),
      phone: graphql.field({ type: graphql.String }),
      role: graphql.field({ type: graphql.String }),
    },
  });

  const DailyCloseOperator = graphql.object<{
    userId: string;
    name: string;
    phone: string;
    role: string | null;
    pin: string;
    active: boolean;
    raw: Record<string, unknown>;
  }>()({
    name: "DailyCloseOperator",
    fields: {
      userId: graphql.field({ type: graphql.nonNull(graphql.String) }),
      name: graphql.field({ type: graphql.nonNull(graphql.String) }),
      phone: graphql.field({ type: graphql.nonNull(graphql.String) }),
      role: graphql.field({ type: graphql.String }),
      pin: graphql.field({ type: graphql.nonNull(graphql.String) }),
      active: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
      raw: graphql.field({
        type: graphql.nonNull(graphql.JSON),
        resolve(item) {
          return item.raw ?? {};
        },
      }),
    },
  });

  const resolveSyncStatus = async (
    context: any,
    date: string,
    deviceId?: string,
  ) => {
    const syncLogWhere = {
      type: "SYNC_DAILY_CLOSE",
      date,
      ...(deviceId ? { deviceId } : {}),
    };

    const [lastSync, lastSuccess] = await Promise.all([
      context.prisma.syncLog.findFirst({
        where: syncLogWhere,
        orderBy: { createdAt: "desc" },
      }),
      context.prisma.syncLog.findFirst({
        where: { ...syncLogWhere, status: "SUCCESS" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const syncStatus = lastSync?.status ?? "PENDING";

    return {
      date,
      deviceId: deviceId ?? lastSync?.deviceId ?? "unknown",
      syncStatus,
      syncedAt: lastSuccess?.createdAt?.toISOString() ?? null,
      lastSyncAttemptAt: lastSync?.createdAt?.toISOString() ?? null,
      hasSyncFailure: syncStatus === "FAILED",
      lastErrorMessage:
        lastSync?.status === "FAILED" ? (lastSync?.errorMessage ?? null) : null,
    };
  };

  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );

  return {
    query: {
      getDailyClose: graphql.field({
        type: DailyCloseDashboard,
        args: {
          date: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          deviceId: graphql.arg({ type: graphql.String }),
        },
        async resolve(_root, args, context) {
          const close = await context.prisma.dailyClose.findFirst({
            where: {
              date: args.date,
              ...(args.deviceId ? { deviceId: args.deviceId } : {}),
            },
            include: {
              items: true,
            },
          });

          if (!close) return null;

          const computedTotal = close.items.reduce((sum: number, item: any) => {
            const subtotal = Number(item.subtotal ?? item.qty * item.price);
            return sum + subtotal;
          }, 0);
          const totalFromItems = close.totalFromItems || computedTotal;
          const syncStatusInfo = await resolveSyncStatus(
            context,
            close.date,
            close.deviceId,
          );

          return {
            id: close.id,
            date: close.date,
            deviceId: close.deviceId,
            cashReceived: close.cashReceived ?? 0,
            bankTransfersReceived: close.bankTransfersReceived ?? 0,
            deliveryCashPaid: close.deliveryCashPaid ?? 0,
            otherCashExpenses: close.otherCashExpenses ?? 0,
            expectedTotal: close.expectedTotal ?? 0,
            totalFromItems,
            cogsCents: close.cogsCents ?? 0,
            grossProfitCents:
              close.grossProfitCents ?? totalFromItems - (close.cogsCents ?? 0),
            grossMarginBps: close.grossMarginBps ?? 0,
            allocatedFixedExpensesCents: close.allocatedFixedExpensesCents ?? 0,
            fixedExpenseRatioBps: close.fixedExpenseRatioBps ?? 0,
            operatingProfitCents:
              close.operatingProfitCents ??
              (close.grossProfitCents ??
                totalFromItems - (close.cogsCents ?? 0)) -
                (close.allocatedFixedExpensesCents ?? 0),
            operatingMarginBps: close.operatingMarginBps ?? 0,
            costingStatus: close.costingStatus ?? "PENDING",
            costingWarnings: close.costingWarnings ?? null,
            notes: close.notes ?? "",
            status: close.status ?? "ACTIVE",
            syncedAt: syncStatusInfo.syncedAt,
            syncStatus: syncStatusInfo.syncStatus,
            lastSyncAttemptAt: syncStatusInfo.lastSyncAttemptAt,
            lastSyncErrorMessage: syncStatusInfo.lastErrorMessage,
            items: close.items.map((item: any) => ({
              id: item.id,
              productId: item.productId,
              name: item.name,
              qty: item.qty ?? 0,
              price: item.price ?? 0,
              subtotal: item.subtotal ?? item.qty * item.price,
            })),
          };
        },
      }),
      getRecentDailyCloses: graphql.field({
        type: graphql.nonNull(
          graphql.list(graphql.nonNull(RecentDailyCloseSummary)),
        ),
        args: {
          days: graphql.arg({ type: graphql.Int, defaultValue: 7 }),
          deviceId: graphql.arg({ type: graphql.String }),
        },
        async resolve(_root, args, context) {
          const take = Math.max(1, Math.min(args.days ?? 7, 31));
          const closes = await context.prisma.dailyClose.findMany({
            where: args.deviceId ? { deviceId: args.deviceId } : {},
            include: { items: true },
            orderBy: { date: "desc" },
            take,
          });

          const syncLogs = await context.prisma.syncLog.findMany({
            where: {
              type: "SYNC_DAILY_CLOSE",
              date: { in: closes.map((c: any) => c.date) },
            },
            orderBy: { createdAt: "desc" },
          });

          const latestSyncByKey = new Map<string, any>();
          for (const log of syncLogs) {
            const key = `${log.date}:${log.deviceId}`;
            if (!latestSyncByKey.has(key)) latestSyncByKey.set(key, log);
          }

          return closes.map((close: any) => {
            const computedTotal = close.items.reduce(
              (sum: number, item: any) =>
                sum + (item.subtotal ?? item.qty * item.price),
              0,
            );
            const totalFromItems = close.totalFromItems || computedTotal;
            const moneyIn =
              (close.cashReceived ?? 0) + (close.bankTransfersReceived ?? 0);
            const moneyOut =
              (close.deliveryCashPaid ?? 0) + (close.otherCashExpenses ?? 0);
            const syncLog = latestSyncByKey.get(
              `${close.date}:${close.deviceId}`,
            );

            return {
              id: close.id,
              date: close.date,
              deviceId: close.deviceId,
              totalFromItems,
              moneyIn,
              moneyOut,
              syncStatus: syncLog?.status ?? "PENDING",
              syncedAt:
                syncLog?.status === "SUCCESS"
                  ? syncLog.createdAt.toISOString()
                  : null,
              status: close.status ?? "ACTIVE",
            };
          });
        },
      }),
      getWeeklyProductBaseline: graphql.field({
        type: graphql.nonNull(
          graphql.list(graphql.nonNull(WeeklyProductBaseline)),
        ),
        args: {
          days: graphql.arg({ type: graphql.Int, defaultValue: 7 }),
          deviceId: graphql.arg({ type: graphql.String }),
        },
        async resolve(_root, args, context) {
          const take = Math.max(1, Math.min(args.days ?? 7, 31));
          const closes = await context.prisma.dailyClose.findMany({
            where: args.deviceId ? { deviceId: args.deviceId } : {},
            include: { items: true },
            orderBy: { date: "desc" },
            take,
          });

          const perProduct = new Map<
            string,
            {
              productId: string;
              name: string;
              qty: number;
              sales: number;
              sampleDays: Set<string>;
            }
          >();

          for (const close of closes) {
            for (const item of close.items) {
              const existing = perProduct.get(item.productId) ?? {
                productId: item.productId,
                name: item.name,
                qty: 0,
                sales: 0,
                sampleDays: new Set<string>(),
              };
              existing.qty += item.qty ?? 0;
              existing.sales +=
                item.subtotal ?? (item.qty ?? 0) * (item.price ?? 0);
              existing.sampleDays.add(close.date);
              perProduct.set(item.productId, existing);
            }
          }

          return Array.from(perProduct.values())
            .map((entry) => {
              const divisor = Math.max(1, entry.sampleDays.size);
              return {
                productId: entry.productId,
                name: entry.name,
                avgQty: entry.qty / divisor,
                avgSales: entry.sales / divisor,
                sampleDays: divisor,
              };
            })
            .sort((a, b) => b.avgSales - a.avgSales);
        },
      }),
      getSyncStatus: graphql.field({
        type: graphql.nonNull(SyncStatusInfo),
        args: {
          date: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          deviceId: graphql.arg({ type: graphql.String }),
        },
        async resolve(_root, args, context) {
          return resolveSyncStatus(
            context,
            args.date,
            args.deviceId ?? undefined,
          );
        },
      }),
      getProductOperationalReport: graphql.field({
        type: graphql.nonNull(
          graphql.list(graphql.nonNull(ProductOperationalReportRow)),
        ),
        args: {
          days: graphql.arg({ type: graphql.Int, defaultValue: 7 }),
        },
        async resolve(_root, args, context) {
          const take = Math.max(1, Math.min(args.days ?? 7, 31));

          const closes = await context.prisma.dailyClose.findMany({
            include: { items: true },
            orderBy: { date: "desc" },
            take,
          });

          const productMap = new Map<
            string,
            {
              productId: string;
              soldQty: number;
              soldSales: number;
              activeDays: Set<string>;
              nameFromItem?: string;
            }
          >();

          for (const close of closes) {
            for (const item of close.items) {
              const current = productMap.get(item.productId) ?? {
                productId: item.productId,
                soldQty: 0,
                soldSales: 0,
                activeDays: new Set<string>(),
                nameFromItem: item.name,
              };
              current.soldQty += item.qty ?? 0;
              current.soldSales += item.subtotal ?? item.qty * item.price;
              current.activeDays.add(close.date);
              if (!current.nameFromItem && item.name)
                current.nameFromItem = item.name;
              productMap.set(item.productId, current);
            }
          }

          const uuidProductIds = Array.from(productMap.keys()).filter(isUuid);
          const catalogProducts =
            uuidProductIds.length > 0
              ? await context.prisma.product.findMany({
                  where: {
                    id: {
                      in: uuidProductIds,
                    },
                  },
                })
              : [];

          const catalogById = new Map(
            catalogProducts.map((p: any) => [p.id, p]),
          );
          const dayCount = Math.max(1, closes.length);

          return Array.from(productMap.values())
            .map((entry) => {
              const catalog = catalogById.get(entry.productId) as
                | { name?: string; price?: number; rawCost?: number }
                | undefined;
              const price = Number(catalog?.price ?? 0);
              const rawCost = Number(catalog?.rawCost ?? 0);
              const avgDailyQty = entry.soldQty / dayCount;
              const avgDailySales = entry.soldSales / dayCount;
              const estimatedGrossProfit =
                entry.soldSales / 100 - rawCost * entry.soldQty;
              const marginPercent =
                entry.soldSales > 0
                  ? (estimatedGrossProfit / (entry.soldSales / 100)) * 100
                  : 0;

              return {
                productId: entry.productId,
                name: String(
                  catalog?.name ?? entry.nameFromItem ?? entry.productId,
                ),
                price,
                rawCost,
                soldQty: entry.soldQty,
                soldSales: entry.soldSales,
                avgDailyQty,
                avgDailySales,
                estimatedGrossProfit,
                marginPercent,
              };
            })
            .sort((a, b) => b.soldSales - a.soldSales);
        },
      }),
      dailyCloseOperators: graphql.field({
        type: graphql.nonNull(
          graphql.list(graphql.nonNull(DailyCloseOperator)),
        ),
        async resolve(_root, _args, context) {
          const rows = await context.prisma.auth.findMany({
            where: {
              pin: { not: null },
              user: { isNot: null },
            },
            include: { user: true },
            orderBy: [{ createdAt: "desc" }],
          });

          return rows
            .filter((row: any) => row.user)
            .map((row: any) => ({
              userId: row.user.id,
              name: row.user.name ?? "",
              phone: row.user.phone ?? "",
              role: row.user.role ?? null,
              pin: String(row.pin ?? ""),
              active: Boolean(row.user.active),
              raw: {
                authId: row.id,
                user: {
                  id: row.user.id,
                  name: row.user.name ?? "",
                  phone: row.user.phone ?? "",
                  role: row.user.role ?? null,
                  active: Boolean(row.user.active),
                },
              },
            }));
        },
      }),
    },
    mutation: {
      upsertDailyCloseRaw,
      validateDailyCloseOperator: graphql.field({
        type: graphql.nonNull(DailyCloseOperatorValidationResult),
        args: {
          phone: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          pin: graphql.arg({ type: graphql.nonNull(graphql.String) }),
        },
        async resolve(_root, args, context) {
          const phone = String(args.phone ?? "").trim();
          const pin = String(args.pin ?? "").trim();

          if (!phone || !pin) {
            return {
              success: false,
              message: "Phone and PIN are required.",
              userId: null,
              name: null,
              phone: null,
              role: null,
            };
          }

          const auth = await context.prisma.auth.findFirst({
            where: {
              pin,
              user: {
                is: {
                  phone,
                  active: true,
                },
              },
            },
            include: {
              user: true,
            },
          });

          if (!auth?.user) {
            return {
              success: false,
              message: "Invalid credentials or inactive user.",
              userId: null,
              name: null,
              phone: null,
              role: null,
            };
          }

          return {
            success: true,
            message: "Validated.",
            userId: auth.user.id,
            name: auth.user.name,
            phone: auth.user.phone,
            role: auth.user.role ?? null,
          };
        },
      }),
    },
  };
});
