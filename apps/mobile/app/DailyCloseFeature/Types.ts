// make a enum with all screens names
export enum Screens {
  PortraitLandingScreen = "PortraitLandingScreen",
  PortraitDailyCloseWizardScreen = "PortraitDailyCloseWizardScreen",
  LandingScreen = "LandingScreen",
  CheckInOutScreen = "CheckInOutScreen",
  OperatorLoginScreen = "OperatorLoginScreen",
  DailySalesScreen = "DailySalesScreen",
  DailySalesConfirmScreen = "DailySalesConfirmScreen",
  IncomeReportScreen = "IncomeReportScreen",
  OutcomeReportScreen = "OutcomeReportScreen",
  IncomeOutputResumeScreen = "IncomeOutputResumeScreen",
  AllReportsScreen = "AllReportsScreen",
  ActivePromosScreen = "ActivePromosScreen",
  WhatsAppInboxScreen = "WhatsAppInboxScreen",
  ConversationMobileScreen = "ConversationMobileScreen",
  WeeklyReportScreen = "WeeklyReportScreen",
  ExpensesListScreen = "ExpensesListScreen",
  AddExpenseScreen = "AddExpenseScreen",
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

export type CloseEvidenceKind =
  | "bathroom_clean"
  | "bathroom_closed"
  | "dining"
  | "trash";

export type CloseEvidencePhoto = {
  kind: CloseEvidenceKind;
  localUri: string;
  takenAt: string;
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
  evidence?: CloseEvidencePhoto[];

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
  evidence?: CloseEvidencePhoto[];

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
  setAvailableProducts: (products: Omit<ProductSale, "qty">[]) => void;
  setTemporalSaleItems: (sale: ProductSale[]) => void;
  setTemporalCashReceived: (amount: number) => void;
  setTemporalBankReceived: (amount: number) => void;
  setTemporalDeliveryCashPaid: (amount: number) => void;
  setTemporalOtherCashExpenses: (amount: number) => void;
  setTemporalNotes: (note: string) => void;
  setTemporalEvidence: (evidence: CloseEvidencePhoto[]) => void;
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
