// /expressApp/src/types/DailyClosePayload.ts
export type ProductSale = {
  productId: string;
  name: string;
  price: number; // cents
  qty: number;
};

export type DailyClosePayload = {
  date: string; // YYYY-MM-DD
  items: ProductSale[];

  cashReceived: number;
  bankTransfersReceived: number;
  deliveryCashPaid: number;
  otherCashExpenses: number;
  notes: string;
  closedByUserId?: string;
  closedByName?: string;
  closedByPhone?: string;
  closedByRaw?: any;

  expectedTotal: number;
  createdAt: string; // ISO
};
