// make a enum with all screens names
export enum Screens {
  LandingScreen = "LandingScreen",
  CheckInOutScreen = "CheckInOutScreen",
  OperatorLoginScreen = "OperatorLoginScreen",
  DailySalesScreen = "DailySalesScreen",
  DailySalesConfirmScreen = "DailySalesConfirmScreen",
  IncomeReportScreen = "IncomeReportScreen",
  OutcomeReportScreen = "OutcomeReportScreen",
  IncomeOutputResumeScreen = "IncomeOutputResumeScreen",
  AllReportsScreen = "AllReportsScreen",
  EmployeeAssistantStep1Screen = "EmployeeAssistantStep1Screen",
  EmployeeAssistantStep2Screen = "EmployeeAssistantStep2Screen",
  EmployeeAssistantStep3Screen = "EmployeeAssistantStep3Screen",
}

export type ProductSale = {
  productId: string;
  name: string;
  price: number;
  qty: number;
};

export type DailyClose = {
  date: string; // YYYY-MM-DD
  items: ProductSale[];

  cashReceived: number;
  bankTransfersReceived: number;
  deliveryCashPaid: number;
  otherCashExpenses: number;
  notes: string;
  closedByUserId: string;
  closedByName: string;
  closedByPhone: string;
  closedByRaw?: Record<string, unknown>;

  expectedTotal: number; // sum(items.qty * items.price)
  createdAt: string; // ISO
};

export type TemportalDailyClose = {
  date?: string; // YYYY-MM-DD
  items?: ProductSale[];

  lastSyncedDate?: string; // YYYY-MM-DD
  setTemporalSaleItems?: number;
  bankTransfersReceived?: number;
  cashReceived?: number;
  deliveryCashPaid?: number;
  otherCashExpenses?: number;
  notes?: string;
  closedByUserId?: string;
  closedByName?: string;
  closedByPhone?: string;
  closedByRaw?: Record<string, unknown>;

  expectedTotal?: number; // sum(items.qty * items.price)
  createdAt?: string; // ISO
  stepPosition?: number | null; // a base 0 index to know the current step in the wizzard
};

export const wizzardSteps = [
  Screens.LandingScreen,
  Screens.OperatorLoginScreen,
  Screens.DailySalesScreen,
  Screens.DailySalesConfirmScreen,
  Screens.IncomeReportScreen,
  Screens.OutcomeReportScreen,
  Screens.IncomeOutputResumeScreen,
] as const;

export type WizzardStep = (typeof wizzardSteps)[number];

export type State = {
  closesByDate: Record<string, DailyClose>;
  availableProducts: Omit<ProductSale, "qty">[];

  temporalSale: TemportalDailyClose;
  closeOperator: {
    userId: string;
    name: string;
    phone: string;
    validatedAt: string;
  } | null;
  // Sicronization
  lastSyncedDate: string; // YYYY-MM-DD
  setLastSyncedDate: (date: string) => void;
  // Sicronization
  shouldSync: () => boolean;
  addSale: (sale: TemportalDailyClose) => void;
  setTemporalSaleItems: (sale: ProductSale[]) => void;
  setTemporalCashReceived: (amount: number) => void;
  setTemporalBankReceived: (amount: number) => void;
  setTemporalDeliveryCashPaid: (amount: number) => void;
  setTemporalOtherCashExpenses: (amount: number) => void;
  setTemporalNotes: (note: string) => void;
  setCloseOperator: (
    operator: {
      userId: string;
      name: string;
      phone: string;
      validatedAt: string;
    } | null,
  ) => void;
  clearCloseOperator: () => void;
  resetTemporalSales: () => void;

  upsertClose: (close: DailyClose) => void;
  getClose: (date: string) => DailyClose | undefined;
  isClosed: (date: string) => boolean;

  // opcional: para soporte
  deleteClose: (date: string) => void;
  clearAll: () => void;

  // ✅ loader
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
};
