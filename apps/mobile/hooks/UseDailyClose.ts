import dayjs from "dayjs";
import { useDailyCloseStore } from "../app/DailyCloseFeature/useDailyCloseStore";
import { CloseEvidencePhoto, DailyClose } from "../app/DailyCloseFeature/Types";
import { restaurantApi } from "../app/DailyCloseFeature/restaurantApi";
import { APP_CONFIG } from "@/constants/config";
import { reportError } from "@/utils/errorLogger";

export type SyncDailyClosesResponse = {
  ok: boolean;
  syncedAt: string;
};

type RemoteProduct = {
  clientId: string;
  name: string;
  priceCents: number;
  active?: boolean;
};

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
    evidence: Array.isArray(close?.evidence)
      ? close.evidence.map((item) => ({
          kind: item.kind,
          localUri: item.localUri || "",
          takenAt: String(item.takenAt || ""),
          remoteUrl: item.remoteUrl,
          remotePublicId: item.remotePublicId,
        }))
      : undefined,
    expectedTotal,
    createdAt,
  };
};

type UploadedEvidence = {
  kind: CloseEvidencePhoto["kind"];
  takenAt: string;
  url: string;
  publicId: string;
};

async function localImageToDataUrl(uri: string) {
  if (uri.startsWith("data:")) return uri;
  const response = await fetch(uri);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  const mime = response.headers.get("content-type") || "image/jpeg";
  return `data:${mime};base64,${btoa(binary)}`;
}

async function uploadCloseEvidence(
  close: DailyClose,
  deviceId: string,
): Promise<UploadedEvidence[]> {
  const photos = close.evidence ?? [];
  const uploaded: UploadedEvidence[] = [];

  for (const photo of photos) {
    if (photo.remoteUrl) {
      uploaded.push({
        kind: photo.kind,
        takenAt: photo.takenAt,
        url: photo.remoteUrl,
        publicId: photo.remotePublicId ?? "",
      });
      continue;
    }
    if (!photo.localUri) {
      uploaded.push({
        kind: photo.kind,
        takenAt: photo.takenAt,
        url: "",
        publicId: "",
      });
      continue;
    }
    const dataUrl = await localImageToDataUrl(photo.localUri);
    const remote = await restaurantApi<UploadedEvidence>(
      "/daily-closes/evidence",
      {
        method: "POST",
        body: JSON.stringify({
          date: close.date,
          kind: photo.kind,
          takenAt: photo.takenAt,
          deviceId,
          dataUrl,
        }),
      },
    );
    uploaded.push(remote);
  }

  useDailyCloseStore.getState().upsertClose({
    ...close,
    evidence: photos.map((photo, index) => ({
      ...photo,
      remoteUrl: uploaded[index]?.url || photo.remoteUrl,
      remotePublicId: uploaded[index]?.publicId || photo.remotePublicId,
    })),
  });

  return uploaded;
}

export const refreshRestaurantProducts = async () => {
  const products = await restaurantApi<RemoteProduct[]>("/products");
  const next = products
    .filter((item) => item.active !== false && item.clientId && item.name)
    .map((item) => ({
      productId: item.clientId,
      name: item.name,
      price: Number(item.priceCents || 0),
    }));
  if (next.length > 0) {
    useDailyCloseStore.getState().setAvailableProducts(next);
  }
  return next;
};

export const syncDailyCloses = async (): Promise<SyncDailyClosesResponse> => {
  const { closesByDate, lastSyncedDate } = useDailyCloseStore.getState();
  const closesToSync = getUnsyncedCloses(closesByDate, lastSyncedDate);

  try {
    await refreshRestaurantProducts();
  } catch (error) {
    reportError(error, {
      tags: { scope: "refresh_restaurant_products" },
    });
  }

  if (closesToSync.length === 0) {
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

      try {
        const evidence = await uploadCloseEvidence(
          {
            ...normalizedClose,
            evidence: close.evidence,
          },
          deviceId,
        );
        await restaurantApi("/daily-closes", {
          method: "PUT",
          body: JSON.stringify({
            deviceId,
            date: normalizedClose.date,
            items: normalizedClose.items.map((item) => ({
              productId: item.productId,
              name: item.name,
              priceCents: item.price,
              qty: item.qty,
            })),
            cashReceived: normalizedClose.cashReceived,
            bankTransfersReceived: normalizedClose.bankTransfersReceived,
            deliveryCashPaid: normalizedClose.deliveryCashPaid,
            otherCashExpenses: normalizedClose.otherCashExpenses,
            notes: normalizedClose.notes,
            closedByUserId: normalizedClose.closedByUserId,
            closedByName: normalizedClose.closedByName,
            closedByPhone: normalizedClose.closedByPhone,
            evidence: evidence.map((item) => ({
              kind: item.kind,
              takenAt: item.takenAt,
              url: item.url,
              publicId: item.publicId,
            })),
            expectedTotal: normalizedClose.expectedTotal,
            createdAt: normalizedClose.createdAt,
          }),
        });
      } catch (error) {
        reportError(error, {
          tags: { scope: "sync_daily_closes_single_mutation" },
          extra: {
            deviceId,
            failingDate: normalizedClose.date,
          },
        });
        continue;
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
      tags: { scope: "sync_daily_closes" },
      extra: {
        deviceId,
        closesPendingCount: closesToSync.length,
        lastSyncedDate: lastSyncedDate ?? null,
      },
    });
    return {
      ok: false,
      syncedAt: dayjs().toISOString(),
    };
  }
};
