// /src/api/syncDailyCloses.ts
// (comment) full path: src/api/syncDailyCloses.ts
import dayjs from "dayjs";
import { gql } from "@apollo/client";
import { client } from "../apollo/client";
import { useDailyCloseStore } from "../app/DailyCloseFeature/useDailyCloseStore";
import { DailyClose } from "../app/DailyCloseFeature/Types";
import { APP_CONFIG } from "@/constants/config";
import { reportError } from "@/utils/errorLogger";

export type SyncDailyClosesResponse = {
  ok: boolean;
  syncedAt: string; // ISO
};

const UPSERT_DAILY_CLOSE_RAW = gql`
  mutation upsertDailyCloseRaw(
    $deviceId: String!
    $date: String!
    $payload: JSON!
  ) {
    upsertDailyCloseRaw(deviceId: $deviceId, date: $date, payload: $payload) {
      success
      date
      syncedAt
    }
  }
`;

const getUnsyncedCloses = (
  closesByDate: Record<string, DailyClose>,
  lastSyncedDate?: string,
): DailyClose[] => {
  const sorted = Object.values(closesByDate || {}).sort(
    (a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf(),
  );

  if (!lastSyncedDate) return sorted;

  return sorted.filter((close) =>
    dayjs(close.date).isAfter(dayjs(lastSyncedDate)),
  );
};

const normalizeCloseForSync = (close: DailyClose): DailyClose | null => {
  const parsedDate = dayjs(close?.date);
  if (!parsedDate.isValid()) return null;

  const items = Array.isArray(close?.items)
    ? close.items
        .filter((item) => item && item.productId && item.name)
        .map((item) => ({
          productId: String(item.productId),
          name: String(item.name),
          price: Number(item.price || 0),
          qty: Number(item.qty || 0),
        }))
    : [];

  const expectedTotal =
    typeof close?.expectedTotal === "number"
      ? close.expectedTotal
      : items.reduce((acc, item) => acc + item.qty * item.price, 0);

  const createdAt = dayjs(close?.createdAt).isValid()
    ? dayjs(close.createdAt).toISOString()
    : parsedDate.endOf("day").toISOString();

  return {
    date: parsedDate.format("YYYY-MM-DD"),
    items,
    cashReceived: Number(close?.cashReceived || 0),
    bankTransfersReceived: Number(close?.bankTransfersReceived || 0),
    deliveryCashPaid: Number(close?.deliveryCashPaid || 0),
    otherCashExpenses: Number(close?.otherCashExpenses || 0),
    notes: String(close?.notes || ""),
    closedByUserId: String(close?.closedByUserId || ""),
    closedByName: String(close?.closedByName || ""),
    closedByPhone: String(close?.closedByPhone || ""),
    closedByRaw:
      close?.closedByRaw && typeof close.closedByRaw === "object"
        ? (close.closedByRaw as Record<string, unknown>)
        : undefined,
    expectedTotal,
    createdAt,
  };
};

const hasToISOStringError = (error: unknown) => {
  const message =
    (error as { message?: string })?.message ||
    (error as { graphQLErrors?: Array<{ message?: string }> })?.graphQLErrors
      ?.map((item) => item?.message || "")
      .join(" | ") ||
    "";
  return message.includes("toISOString");
};

export const syncDailyCloses = async (): Promise<SyncDailyClosesResponse> => {
  const { closesByDate, lastSyncedDate } = useDailyCloseStore.getState();
  const closesToSync = getUnsyncedCloses(closesByDate, lastSyncedDate);

  if (closesToSync.length === 0) {
    console.log("[LOG]:", lastSyncedDate);
    return {
      ok: true,
      syncedAt: lastSyncedDate
        ? dayjs(lastSyncedDate).toISOString()
        : dayjs("1900-01-01").toISOString(),
    };
  }

  const deviceId = APP_CONFIG.deviceId;

  try {
    let syncedCount = 0;
    let lastSyncedCloseDate: string | null = null;

    for (const close of closesToSync) {
      const normalizedClose = normalizeCloseForSync(close);

      if (!normalizedClose) {
        reportError(new Error("Invalid daily close skipped before sync"), {
          tags: { scope: "sync_daily_closes_invalid_payload" },
          extra: {
            originalDate: close?.date,
            originalCreatedAt: close?.createdAt,
          },
        });
        continue;
      }

      const variables = {
        deviceId,
        date: normalizedClose.date,
        payload: {
          ...normalizedClose,
          // Defensive field for backends that normalize receivedAt from payload.
          receivedAt: normalizedClose.createdAt,
        },
      };

      console.log("[syncDailyCloses][sending]", {
        deviceId: variables.deviceId,
        date: variables.date,
        payloadDate: variables.payload.date,
        createdAt: variables.payload.createdAt,
      });
      console.log("[syncDailyCloses][variables]", JSON.stringify(variables));

      try {
        await client.mutate({
          mutation: UPSERT_DAILY_CLOSE_RAW,
          variables,
        });
      } catch (error) {
        const apolloError = error as {
          graphQLErrors?: Array<{ message?: string; extensions?: unknown }>;
          networkError?: unknown;
          message?: string;
        };

        // Retry once with forced ISO dates when backend complains about toISOString.
        if (hasToISOStringError(error)) {
          const fallbackCreatedAt = dayjs().toISOString();
          const retryVariables = {
            ...variables,
            payload: {
              ...variables.payload,
              createdAt: fallbackCreatedAt,
              receivedAt: fallbackCreatedAt,
            },
          };

          try {
            await client.mutate({
              mutation: UPSERT_DAILY_CLOSE_RAW,
              variables: retryVariables,
            });

            reportError(
              new Error(
                "syncDailyCloses recovered from toISOString payload error",
              ),
              {
                tags: { scope: "sync_daily_closes_recovered" },
                extra: {
                  deviceId,
                  failingDate: normalizedClose.date,
                  originalCreatedAt: normalizedClose.createdAt,
                  fallbackCreatedAt,
                },
              },
            );
          } catch (retryError) {
            reportError(retryError, {
              tags: { scope: "sync_daily_closes_single_mutation_retry_failed" },
              extra: {
                deviceId,
                failingDate: normalizedClose.date,
                variables: retryVariables,
              },
            });
            continue;
          }
        } else {
          reportError(error, {
            tags: {
              scope: "sync_daily_closes_single_mutation",
            },
            extra: {
              deviceId,
              failingDate: normalizedClose.date,
              failingCreatedAt: normalizedClose.createdAt,
              variables,
              graphQLErrors: apolloError.graphQLErrors?.map((item) => ({
                message: item?.message,
                extensions: item?.extensions,
              })),
              networkError: apolloError.networkError,
              apolloMessage: apolloError.message,
            },
          });
          continue;
        }
      }

      syncedCount += 1;
      lastSyncedCloseDate = normalizedClose.date;
    }

    if (syncedCount === 0 || !lastSyncedCloseDate) {
      return {
        ok: false,
        syncedAt: lastSyncedDate
          ? dayjs(lastSyncedDate).toISOString()
          : dayjs("1900-01-01").toISOString(),
      };
    }

    return {
      ok: true,
      syncedAt: dayjs(lastSyncedCloseDate).toISOString(),
    };
  } catch (error) {
    reportError(error, {
      tags: {
        scope: "sync_daily_closes",
      },
      extra: {
        deviceId,
        closesPendingCount: closesToSync.length,
        firstPendingDate: closesToSync[0]?.date,
        lastPendingDate: closesToSync[closesToSync.length - 1]?.date,
        lastSyncedDate: lastSyncedDate ?? null,
        attemptedDates: closesToSync.map((close) => close.date),
      },
    });
    return {
      ok: false,
      syncedAt: dayjs().toISOString(),
    };
  }
};
