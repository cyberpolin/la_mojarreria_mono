import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DailyClose, ProductSale, State, TemportalDailyClose } from "./Types";
import dayjs from "dayjs";
import { needsSync } from "./helpers";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_CONFIG } from "@/constants/config";

const availableProducts = [
  {
    productId: "001",
    name: "Mojarra Frita",
    desc: "esta rica",
    price: 15000, // all prices will include 2 decimals as an integer i.e. 50000 === 500.00
  },
  {
    productId: "002",
    name: "Empanada de Camaron con Queso (Orden)",
    desc: "esta rica",
    price: 10000, // all prices will include 2 decimals as an integer i.e. 50000 === 500.00
  },
  {
    productId: "003",
    name: "Empanada de Minilla (Orden)",
    desc: "esta rica",
    price: 10000, // all prices will include 2 decimals as an integer i.e. 50000 === 500.00
  },
];

const SHOULD_SEED = APP_CONFIG.seed;
const SHOULD_CLEAN = APP_CONFIG.clean;
const IS_PRODUCTION =
  APP_CONFIG.env === "production" || APP_CONFIG.env === "prod";
const SEEDED_CLOSING_USER_ID = "11111111-1111-4111-8111-111111111111";
const SEEDED_CLOSING_USER_NAME = "Super Admin";
const SEEDED_CLOSING_USER_PHONE = "521999999999";

const buildSeedCloses = (count: number) => {
  const closes: Record<string, DailyClose> = {};
  for (let i = count; i >= 1; i--) {
    const date = dayjs().subtract(i, "day").format("YYYY-MM-DD");
    const items = [
      {
        productId: availableProducts[0]?.productId || "001",
        name: availableProducts[0]?.name || "Mojarra Frita",
        price: availableProducts[0]?.price || 15000,
        qty: 3 + (i % 5),
      },
      {
        productId: availableProducts[1]?.productId || "002",
        name: availableProducts[1]?.name || "Empanada Camaron/Queso",
        price: availableProducts[1]?.price || 10000,
        qty: 2 + (i % 4),
      },
    ];
    const expectedTotal = items.reduce(
      (acc, item) => acc + item.qty * item.price,
      0,
    );
    const cashReceived = Math.round(expectedTotal * 0.7);
    const bankTransfersReceived = expectedTotal - cashReceived;
    const deliveryCashPaid = 2000 + (i % 3) * 1000;
    const otherCashExpenses = 1000 + (i % 4) * 500;

    closes[date] = {
      date,
      items,
      cashReceived,
      bankTransfersReceived,
      deliveryCashPaid,
      otherCashExpenses,
      notes: "Seeded close",
      closedByUserId: SEEDED_CLOSING_USER_ID,
      closedByName: SEEDED_CLOSING_USER_NAME,
      closedByPhone: SEEDED_CLOSING_USER_PHONE,
      expectedTotal,
      createdAt: dayjs(date).hour(23).minute(30).second(0).toISOString(),
    };
  }
  return closes;
};

export const useDailyCloseStore = create<State>()(
  persist(
    (set, get) => ({
      availableProducts,

      closesByDate: {},
      lastSyncedDate: "1900-01-01", // a very old date
      // Sicronization
      shouldSync: () => {
        const { closesByDate, lastSyncedDate } = get();
        return (
          needsSync(closesByDate, lastSyncedDate) &&
          Object.keys(closesByDate).length > 0
        );
      },
      setLastSyncedDate: (date: string) => set({ lastSyncedDate: date }),
      // Sicronization
      // temporalClosing
      temporalSale: {},
      closeOperator: null,
      addSale: (sale: TemportalDailyClose) => {
        try {
          set(({ temporalSale }: { temporalSale: TemportalDailyClose }) => ({
            temporalSale: { ...temporalSale, ...sale },
          }));
          return true;
        } catch {
          return false;
        }
      },

      // step 1: set temporal sale items
      setTemporalSaleItems: (sale: ProductSale[]) => {
        return set(
          ({ temporalSale }: { temporalSale: TemportalDailyClose }) => ({
            temporalSale: {
              ...temporalSale,
              ...{ items: sale },
              date: dayjs().toISOString(),
              stepPosition: 1,
            },
          }),
        );
      },
      // step 2: set temporal cash received
      setTemporalCashReceived: (sale: number) => {
        return set(
          ({ temporalSale }: { temporalSale: TemportalDailyClose }) => ({
            temporalSale: {
              ...temporalSale,
              ...{ cashReceived: sale },
              date: dayjs().toISOString(),
              stepPosition: 2,
            },
          }),
        );
      },
      // step 3: set temporal bank received
      setTemporalBankReceived: (sale: number) => {
        return set(
          ({ temporalSale }: { temporalSale: TemportalDailyClose }) => ({
            temporalSale: {
              ...temporalSale,
              ...{ bankTransfersReceived: sale },
              date: dayjs().toISOString(),
              stepPosition: 3,
            },
          }),
        );
      },
      // step 4: set temporal other cash expenses
      setTemporalOtherCashExpenses: (sale: number) => {
        return set(
          ({ temporalSale }: { temporalSale: TemportalDailyClose }) => ({
            temporalSale: {
              ...temporalSale,
              ...{ otherCashExpenses: sale },
              date: dayjs().toISOString(),
              stepPosition: 4,
            },
          }),
        );
      },
      // step 5: set temporal delivery cash paid
      setTemporalDeliveryCashPaid: (sale: number) => {
        return set(
          ({ temporalSale }: { temporalSale: TemportalDailyClose }) => ({
            temporalSale: {
              ...temporalSale,
              ...{ deliveryCashPaid: sale },
              date: dayjs().toISOString(),
              stepPosition: 5,
            },
          }),
        );
      },
      // step 6: set temporal notes
      setTemporalNotes: (notes: string) => {
        return set(
          ({ temporalSale }: { temporalSale: TemportalDailyClose }) => ({
            temporalSale: {
              ...temporalSale,
              ...{ notes },
              date: dayjs().toISOString(),
              stepPosition: 6,
            },
          }),
        );
      },
      setCloseOperator: (operator) => set({ closeOperator: operator }),
      clearCloseOperator: () => set({ closeOperator: null }),

      //clean the temporal data
      resetTemporalSales: () =>
        set({ temporalSale: {} as TemportalDailyClose }),

      // temporalClosing

      upsertClose: (close) =>
        set((state) => ({
          closesByDate: { ...state.closesByDate, [close.date]: close },
        })),

      getClose: (date) => get().closesByDate[date],
      isClosed: (date) => !!get().closesByDate[date],

      deleteClose: (date) =>
        set((state) => {
          const next = { ...state.closesByDate };
          delete next[date];
          return { closesByDate: next };
        }),

      clearAll: () => set({ closesByDate: {} }),

      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: "daily-close-store",
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...((persistedState as Record<string, unknown>) ?? {}),
        availableProducts,
      }),
      // ✅ esta es la clave
      onRehydrateStorage: () => (state) => {
        if (SHOULD_CLEAN) {
          // Clear persisted storage and in-memory state
          AsyncStorage.removeItem("daily-close-store").catch(() => undefined);
          state?.clearAll();
          state?.resetTemporalSales();
          state?.setLastSyncedDate("1900-01-01");
        }

        if (SHOULD_SEED && !IS_PRODUCTION) {
          const seed = buildSeedCloses(20);
          state?.clearAll();
          Object.values(seed).forEach((close) => {
            state?.upsertClose(close);
          });
          state?.setLastSyncedDate("1900-01-01");
        }

        state?.setHasHydrated(true);
      },
      // opcional: versión para migraciones futuras
      version: 1,
    },
  ),
);
