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
          return (item.costingWarnings ?? null) as any;
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
          return (item.raw ?? {}) as any;
        },
      }),
    },
  });

  const AttendanceEmployeeSchedule = graphql.object<{
    days: unknown;
    shiftStart: string;
    shiftEnd: string;
    breakMinutes: number;
    active: boolean;
  }>()({
    name: "AttendanceEmployeeSchedule",
    fields: {
      days: graphql.field({
        type: graphql.JSON,
        resolve(item) {
          return item.days as any;
        },
      }),
      shiftStart: graphql.field({ type: graphql.nonNull(graphql.String) }),
      shiftEnd: graphql.field({ type: graphql.nonNull(graphql.String) }),
      breakMinutes: graphql.field({ type: graphql.nonNull(graphql.Int) }),
      active: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    },
  });

  const AttendanceEmployee = graphql.object<{
    userId: string;
    name: string;
    phone: string;
    role: string | null;
    pin: string;
    deviceId: string;
    active: boolean;
    schedule: {
      days: unknown;
      shiftStart: string;
      shiftEnd: string;
      breakMinutes: number;
      active: boolean;
    } | null;
  }>()({
    name: "AttendanceEmployee",
    fields: {
      userId: graphql.field({ type: graphql.nonNull(graphql.String) }),
      name: graphql.field({ type: graphql.nonNull(graphql.String) }),
      phone: graphql.field({ type: graphql.nonNull(graphql.String) }),
      role: graphql.field({ type: graphql.String }),
      pin: graphql.field({ type: graphql.nonNull(graphql.String) }),
      deviceId: graphql.field({ type: graphql.nonNull(graphql.String) }),
      active: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
      schedule: graphql.field({ type: AttendanceEmployeeSchedule }),
    },
  });

  const AttendanceLogSummary = graphql.object<{
    id: string;
    userId: string;
    deviceId: string;
    date: string;
    clockInAt: string | null;
    clockOutAt: string | null;
    durationMinutes: number;
    status: string;
    checkInMutationId: string;
    checkOutMutationId: string | null;
  }>()({
    name: "AttendanceLogSummary",
    fields: {
      id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
      userId: graphql.field({ type: graphql.nonNull(graphql.String) }),
      deviceId: graphql.field({ type: graphql.nonNull(graphql.String) }),
      date: graphql.field({ type: graphql.nonNull(graphql.String) }),
      clockInAt: graphql.field({ type: graphql.String }),
      clockOutAt: graphql.field({ type: graphql.String }),
      durationMinutes: graphql.field({ type: graphql.nonNull(graphql.Int) }),
      status: graphql.field({ type: graphql.nonNull(graphql.String) }),
      checkInMutationId: graphql.field({
        type: graphql.nonNull(graphql.String),
      }),
      checkOutMutationId: graphql.field({ type: graphql.String }),
    },
  });

  const AttendanceValidationResult = graphql.object<{
    success: boolean;
    message: string;
    employee: any | null;
    openLog: any | null;
  }>()({
    name: "AttendanceValidationResult",
    fields: {
      success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
      message: graphql.field({ type: graphql.nonNull(graphql.String) }),
      employee: graphql.field({ type: AttendanceEmployee }),
      openLog: graphql.field({ type: AttendanceLogSummary }),
    },
  });

  const AttendanceMutationResult = graphql.object<{
    success: boolean;
    message: string;
    action: string | null;
    pendingPreviousCheckout: boolean;
    log: any | null;
  }>()({
    name: "AttendanceMutationResult",
    fields: {
      success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
      message: graphql.field({ type: graphql.nonNull(graphql.String) }),
      action: graphql.field({ type: graphql.String }),
      pendingPreviousCheckout: graphql.field({
        type: graphql.nonNull(graphql.Boolean),
      }),
      log: graphql.field({ type: AttendanceLogSummary }),
    },
  });

  const PendingAttendanceCheckIn = graphql.object<{
    userId: string;
    name: string;
    phone: string;
    role: string | null;
    deviceId: string;
    shiftStart: string;
    shiftEnd: string;
    breakMinutes: number;
  }>()({
    name: "PendingAttendanceCheckIn",
    fields: {
      userId: graphql.field({ type: graphql.nonNull(graphql.String) }),
      name: graphql.field({ type: graphql.nonNull(graphql.String) }),
      phone: graphql.field({ type: graphql.nonNull(graphql.String) }),
      role: graphql.field({ type: graphql.String }),
      deviceId: graphql.field({ type: graphql.nonNull(graphql.String) }),
      shiftStart: graphql.field({ type: graphql.nonNull(graphql.String) }),
      shiftEnd: graphql.field({ type: graphql.nonNull(graphql.String) }),
      breakMinutes: graphql.field({ type: graphql.nonNull(graphql.Int) }),
    },
  });

  const normalizePhone = (value: string) => value.replace(/\D/g, "");
  const normalizeDayToken = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const dayAliasesByIndex = [
    ["sun", "sunday", "domingo", "dom"],
    ["mon", "monday", "lunes", "lun"],
    ["tue", "tuesday", "martes", "mar"],
    ["wed", "wednesday", "miercoles", "mie", "miércoles"],
    ["thu", "thursday", "jueves", "jue"],
    ["fri", "friday", "viernes", "vie"],
    ["sat", "saturday", "sabado", "sab", "sábado"],
  ];
  const isAllowedToday = (schedule: any, date: Date) => {
    if (!schedule?.active) return false;
    const days = Array.isArray(schedule.days) ? schedule.days : [];
    if (days.length === 0) return true;
    const todayAliases =
      dayAliasesByIndex[date.getDay()].map(normalizeDayToken);
    return days.some((day: unknown) =>
      todayAliases.includes(normalizeDayToken(String(day))),
    );
  };
  const parseDateOnly = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day, 12, 0, 0);
  };
  const toAttendanceEmployee = (assignment: any) => ({
    userId: assignment.user.id,
    name: assignment.user.name ?? "",
    phone: assignment.user.phone ?? "",
    role: assignment.user.role ?? null,
    pin: String(assignment.user.auth?.pin ?? ""),
    deviceId: assignment.deviceId,
    active: Boolean(assignment.user.active && assignment.active),
    schedule: assignment.user.schedule
      ? {
          days: assignment.user.schedule.days ?? [],
          shiftStart: assignment.user.schedule.shiftStart ?? "",
          shiftEnd: assignment.user.schedule.shiftEnd ?? "",
          breakMinutes: Number(assignment.user.schedule.breakMinutes ?? 0),
          active: Boolean(assignment.user.schedule.active),
        }
      : null,
  });
  const toAttendanceLogSummary = (log: any) =>
    log
      ? {
          id: log.id,
          userId: log.userId ?? "",
          deviceId: log.deviceId ?? "",
          date: log.date ?? "",
          clockInAt: log.clockInAt?.toISOString?.() ?? null,
          clockOutAt: log.clockOutAt?.toISOString?.() ?? null,
          durationMinutes: Number(log.durationMinutes ?? 0),
          status: log.status ?? "",
          checkInMutationId: log.checkInMutationId ?? "",
          checkOutMutationId: log.checkOutMutationId ?? null,
        }
      : null;
  const resolveAttendanceEmployee = async (
    context: any,
    phone: string,
    pin: string,
    deviceId: string,
  ) => {
    const normalizedPhone = normalizePhone(phone);
    const assignments = await context.prisma.employeeDeviceAssignment.findMany({
      where: {
        deviceId,
        active: true,
        user: {
          is: {
            active: true,
            auth: {
              is: {
                pin,
              },
            },
          },
        },
      },
      include: {
        user: {
          include: {
            auth: true,
            schedule: true,
          },
        },
      },
    });
    return (
      assignments.find(
        (assignment: any) =>
          assignment.user &&
          normalizePhone(assignment.user.phone ?? "") === normalizedPhone,
      ) ?? null
    );
  };

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
      attendanceEmployees: graphql.field({
        type: graphql.nonNull(
          graphql.list(graphql.nonNull(AttendanceEmployee)),
        ),
        args: {
          deviceId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
        },
        async resolve(_root, args, context) {
          const assignments =
            await context.prisma.employeeDeviceAssignment.findMany({
              where: {
                deviceId: String(args.deviceId ?? "").trim(),
                active: true,
                user: {
                  is: {
                    active: true,
                    auth: {
                      is: {
                        pin: { not: null },
                      },
                    },
                  },
                },
              },
              include: {
                user: {
                  include: {
                    auth: true,
                    schedule: true,
                  },
                },
              },
              orderBy: [{ updatedAt: "desc" }],
            });

          return assignments
            .filter((assignment: any) => assignment.user?.auth?.pin)
            .map(toAttendanceEmployee);
        },
      }),
      pendingAttendanceCheckIns: graphql.field({
        type: graphql.nonNull(
          graphql.list(graphql.nonNull(PendingAttendanceCheckIn)),
        ),
        args: {
          deviceId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          date: graphql.arg({ type: graphql.nonNull(graphql.String) }),
        },
        async resolve(_root, args, context) {
          const deviceId = String(args.deviceId ?? "").trim();
          const date = String(args.date ?? "").trim();
          const parsedDate = parseDateOnly(date);

          if (!deviceId || !parsedDate) return [];

          const assignments =
            await context.prisma.employeeDeviceAssignment.findMany({
              where: {
                deviceId,
                active: true,
                user: {
                  is: {
                    active: true,
                    schedule: {
                      is: {
                        active: true,
                      },
                    },
                  },
                },
              },
              include: {
                user: {
                  include: {
                    schedule: true,
                  },
                },
              },
              orderBy: [{ updatedAt: "desc" }],
            });

          const logs = await context.prisma.attendanceLog.findMany({
            where: {
              deviceId,
              date,
              clockInAt: { not: null },
            },
            select: { userId: true },
          });
          const checkedInUserIds = new Set(
            logs.map((log: any) => log.userId).filter(Boolean),
          );

          return assignments
            .filter((assignment: any) => {
              if (!assignment.user?.schedule) return false;
              if (checkedInUserIds.has(assignment.user.id)) return false;
              return isAllowedToday(assignment.user.schedule, parsedDate);
            })
            .map((assignment: any) => ({
              userId: assignment.user.id,
              name: assignment.user.name ?? "",
              phone: assignment.user.phone ?? "",
              role: assignment.user.role ?? null,
              deviceId: assignment.deviceId,
              shiftStart: assignment.user.schedule?.shiftStart ?? "",
              shiftEnd: assignment.user.schedule?.shiftEnd ?? "",
              breakMinutes: Number(assignment.user.schedule?.breakMinutes ?? 0),
            }));
        },
      }),
    },
    mutation: {
      upsertDailyCloseRaw,
      validateAttendanceEmployee: graphql.field({
        type: graphql.nonNull(AttendanceValidationResult),
        args: {
          deviceId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          phone: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          pin: graphql.arg({ type: graphql.nonNull(graphql.String) }),
        },
        async resolve(_root, args, context) {
          const deviceId = String(args.deviceId ?? "").trim();
          const phone = String(args.phone ?? "").trim();
          const pin = String(args.pin ?? "").trim();

          if (!deviceId || !phone || !pin) {
            return {
              success: false,
              message: "Device, phone and PIN are required.",
              employee: null,
              openLog: null,
            };
          }

          const assignment = await resolveAttendanceEmployee(
            context,
            phone,
            pin,
            deviceId,
          );

          if (!assignment?.user) {
            return {
              success: false,
              message: "Invalid credentials or employee is not assigned here.",
              employee: null,
              openLog: null,
            };
          }

          if (!isAllowedToday(assignment.user.schedule, new Date())) {
            return {
              success: false,
              message: "Employee is not scheduled for today.",
              employee: toAttendanceEmployee(assignment),
              openLog: null,
            };
          }

          const openLog = await context.prisma.attendanceLog.findFirst({
            where: {
              userId: assignment.user.id,
              deviceId,
              status: "OPEN",
            },
            orderBy: [{ clockInAt: "desc" }],
          });

          const closedToday = await context.prisma.attendanceLog.findFirst({
            where: {
              userId: assignment.user.id,
              deviceId,
              date: new Date().toISOString().slice(0, 10),
              status: "CLOSED",
            },
            orderBy: [{ clockOutAt: "desc" }],
          });

          if (!openLog && closedToday) {
            return {
              success: false,
              message: "Employee already completed check-in/out today.",
              employee: toAttendanceEmployee(assignment),
              openLog: null,
            };
          }

          return {
            success: true,
            message: "Validated.",
            employee: toAttendanceEmployee(assignment),
            openLog: toAttendanceLogSummary(openLog),
          };
        },
      }),
      recordAttendanceEvent: graphql.field({
        type: graphql.nonNull(AttendanceMutationResult),
        args: {
          deviceId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          userId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          action: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          occurredAt: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          date: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          mutationId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
        },
        async resolve(_root, args, context) {
          const deviceId = String(args.deviceId ?? "").trim();
          const userId = String(args.userId ?? "").trim();
          const action = String(args.action ?? "").trim();
          const date = String(args.date ?? "").trim();
          const mutationId = String(args.mutationId ?? "").trim();
          const occurredAt = new Date(String(args.occurredAt ?? ""));

          if (
            !deviceId ||
            !userId ||
            !date ||
            !mutationId ||
            Number.isNaN(occurredAt.getTime())
          ) {
            return {
              success: false,
              message: "Invalid attendance payload.",
              action: null,
              pendingPreviousCheckout: false,
              log: null,
            };
          }

          const existing = await context.prisma.attendanceLog.findFirst({
            where: {
              OR: [
                { checkInMutationId: mutationId },
                { checkOutMutationId: mutationId },
              ],
            },
          });
          if (existing) {
            return {
              success: true,
              message: "Already recorded.",
              action,
              pendingPreviousCheckout: false,
              log: toAttendanceLogSummary(existing),
            };
          }

          const assignment =
            await context.prisma.employeeDeviceAssignment.findFirst({
              where: {
                userId,
                deviceId,
                active: true,
                user: {
                  is: {
                    active: true,
                  },
                },
              },
              include: {
                user: {
                  include: {
                    auth: true,
                    schedule: true,
                  },
                },
              },
            });

          if (!assignment?.user) {
            return {
              success: false,
              message: "Employee is not assigned here.",
              action: null,
              pendingPreviousCheckout: false,
              log: null,
            };
          }

          const openLog = await context.prisma.attendanceLog.findFirst({
            where: {
              userId: assignment.user.id,
              deviceId,
              status: "OPEN",
            },
            orderBy: [{ clockInAt: "desc" }],
          });

          if (action === "CHECK_IN") {
            if (!isAllowedToday(assignment.user.schedule, occurredAt)) {
              return {
                success: false,
                message: "Employee is not scheduled for this day.",
                action,
                pendingPreviousCheckout: false,
                log: null,
              };
            }

            if (openLog) {
              return {
                success: false,
                message: "Employee has a pending checkout.",
                action,
                pendingPreviousCheckout: true,
                log: toAttendanceLogSummary(openLog),
              };
            }

            const closedToday = await context.prisma.attendanceLog.findFirst({
              where: {
                userId: assignment.user.id,
                deviceId,
                date,
                status: "CLOSED",
              },
              orderBy: [{ clockOutAt: "desc" }],
            });

            if (closedToday) {
              return {
                success: false,
                message: "Employee already completed check-in/out today.",
                action,
                pendingPreviousCheckout: false,
                log: toAttendanceLogSummary(closedToday),
              };
            }

            const created = await context.prisma.attendanceLog.create({
              data: {
                userId: assignment.user.id,
                deviceId,
                date,
                clockInAt: occurredAt,
                status: "OPEN",
                source: "mobile",
                checkInMutationId: mutationId,
              },
            });

            return {
              success: true,
              message: "Check-in recorded.",
              action,
              pendingPreviousCheckout: false,
              log: toAttendanceLogSummary(created),
            };
          }

          if (action === "CHECK_OUT") {
            if (!openLog) {
              return {
                success: false,
                message: "No open check-in found.",
                action,
                pendingPreviousCheckout: false,
                log: null,
              };
            }

            const durationMinutes = openLog.clockInAt
              ? Math.max(
                  0,
                  Math.floor(
                    (occurredAt.getTime() - openLog.clockInAt.getTime()) /
                      60000,
                  ),
                )
              : 0;
            const updated = await context.prisma.attendanceLog.update({
              where: { id: openLog.id },
              data: {
                clockOutAt: occurredAt,
                durationMinutes,
                status: "CLOSED",
                checkOutMutationId: mutationId,
              },
            });

            return {
              success: true,
              message: "Check-out recorded.",
              action,
              pendingPreviousCheckout: false,
              log: toAttendanceLogSummary(updated),
            };
          }

          return {
            success: false,
            message: "Unsupported attendance action.",
            action: null,
            pendingPreviousCheckout: false,
            log: null,
          };
        },
      }),
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
