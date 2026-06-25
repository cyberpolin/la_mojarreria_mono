export type MercadoPagoPreferenceItem = {
  id: string;
  title: string;
  description: string;
  quantity: number;
  unit_price: number;
  currency_id: string;
};

export type CreateMercadoPagoPreferenceParams = {
  accessToken: string;
  items: MercadoPagoPreferenceItem[];
  payer: {
    name: string;
    email: string;
  };
  externalReference: string;
  backUrls: {
    success: string;
    failure: string;
    pending: string;
  };
  notificationUrl: string | null;
};

export type MercadoPagoPreference = {
  id: string;
  initPoint: string;
  sandboxInitPoint: string | null;
};

export type CreateMercadoPagoPreapprovalParams = {
  accessToken: string;
  reason: string;
  payerEmail: string;
  externalReference: string;
  backUrl: string;
  amount: number;
  currencyId: string;
};

export type MercadoPagoPreapproval = {
  id: string;
  status: string;
  externalReference: string | null;
  initPoint: string | null;
  nextPaymentDate: string | null;
  amount: number | null;
  currencyId: string | null;
};

export type MercadoPagoPayment = {
  id: string;
  status: string;
  externalReference: string | null;
  transactionAmount: number | null;
  currencyId: string | null;
  dateApproved: string | null;
  paymentMethodId: string | null;
  cardLast4: string | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function createMercadoPagoPreference(
  params: CreateMercadoPagoPreferenceParams,
): Promise<MercadoPagoPreference> {
  const body = {
    items: params.items,
    payer: params.payer,
    external_reference: params.externalReference,
    back_urls: params.backUrls,
    auto_return: "approved",
    notification_url: params.notificationUrl ?? undefined,
  };

  const response = await fetch(
    "https://api.mercadopago.com/checkout/preferences",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${params.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      isObject(payload) && readString(payload.message)
        ? readString(payload.message)
        : "Mercado Pago preference request failed";
    throw new Error(message ?? "Mercado Pago preference request failed");
  }

  if (!isObject(payload)) {
    throw new Error("Mercado Pago returned an invalid preference response");
  }

  const id = readString(payload.id);
  const initPoint = readString(payload.init_point);
  if (!id || !initPoint) {
    throw new Error(
      "Mercado Pago preference response is missing checkout data",
    );
  }

  return {
    id,
    initPoint,
    sandboxInitPoint: readString(payload.sandbox_init_point),
  };
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function createMercadoPagoPreapproval(
  params: CreateMercadoPagoPreapprovalParams,
): Promise<MercadoPagoPreapproval> {
  const body = {
    reason: params.reason,
    external_reference: params.externalReference,
    payer_email: params.payerEmail,
    back_url: params.backUrl,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: params.amount,
      currency_id: params.currencyId,
    },
    status: "pending",
  };

  const response = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      isObject(payload) && readString(payload.message)
        ? readString(payload.message)
        : "Mercado Pago preapproval request failed";
    throw new Error(message ?? "Mercado Pago preapproval request failed");
  }

  if (!isObject(payload)) {
    throw new Error("Mercado Pago returned an invalid preapproval response");
  }

  return normalizePreapproval(payload);
}

export async function getMercadoPagoPreapproval(params: {
  accessToken: string;
  preapprovalId: string;
}): Promise<MercadoPagoPreapproval> {
  const response = await fetch(
    `https://api.mercadopago.com/preapproval/${encodeURIComponent(
      params.preapprovalId,
    )}`,
    {
      headers: {
        authorization: `Bearer ${params.accessToken}`,
        "content-type": "application/json",
      },
    },
  );

  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      isObject(payload) && readString(payload.message)
        ? readString(payload.message)
        : "Mercado Pago preapproval request failed";
    throw new Error(message ?? "Mercado Pago preapproval request failed");
  }

  if (!isObject(payload)) {
    throw new Error("Mercado Pago returned an invalid preapproval response");
  }

  return normalizePreapproval(payload);
}

function normalizePreapproval(
  payload: Record<string, unknown>,
): MercadoPagoPreapproval {
  const id = readString(payload.id);
  if (!id) {
    throw new Error("Mercado Pago preapproval response is missing id");
  }

  const autoRecurring = isObject(payload.auto_recurring)
    ? payload.auto_recurring
    : null;

  return {
    id,
    status: readString(payload.status) ?? "unknown",
    externalReference: readString(payload.external_reference),
    initPoint: readString(payload.init_point),
    nextPaymentDate:
      readString(payload.next_payment_date) ??
      (autoRecurring ? readString(autoRecurring.next_payment_date) : null),
    amount: autoRecurring
      ? readNumber(autoRecurring.transaction_amount)
      : readNumber(payload.transaction_amount),
    currencyId: autoRecurring
      ? readString(autoRecurring.currency_id)
      : readString(payload.currency_id),
  };
}

export async function getMercadoPagoPayment(params: {
  accessToken: string;
  paymentId: string;
}): Promise<MercadoPagoPayment> {
  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
      params.paymentId,
    )}`,
    {
      headers: {
        authorization: `Bearer ${params.accessToken}`,
        "content-type": "application/json",
      },
    },
  );

  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      isObject(payload) && readString(payload.message)
        ? readString(payload.message)
        : "Mercado Pago payment request failed";
    throw new Error(message ?? "Mercado Pago payment request failed");
  }

  if (!isObject(payload)) {
    throw new Error("Mercado Pago returned an invalid payment response");
  }

  const id = readString(payload.id) ?? String(payload.id ?? "");
  if (!id) {
    throw new Error("Mercado Pago payment response is missing id");
  }

  const card = isObject(payload.card) ? payload.card : null;

  return {
    id,
    status: readString(payload.status) ?? "unknown",
    externalReference: readString(payload.external_reference),
    transactionAmount: readNumber(payload.transaction_amount),
    currencyId: readString(payload.currency_id),
    dateApproved: readString(payload.date_approved),
    paymentMethodId: readString(payload.payment_method_id),
    cardLast4: card ? readString(card.last_four_digits) : null,
  };
}
