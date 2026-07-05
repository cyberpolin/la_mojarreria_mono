export type MercadoPagoPayment = {
  id: string;
  status: string;
  statusDetail: string | null;
  externalReference: string | null;
  transactionAmount: number | null;
  currencyId: string | null;
  dateApproved: string | null;
  paymentMethodId: string | null;
};

export type MercadoPagoErrorCause = {
  code: string | null;
  description: string | null;
  data: string | null;
};

export class MercadoPagoRequestError extends Error {
  status: number;
  error: string | null;
  causes: MercadoPagoErrorCause[];

  constructor(params: {
    message: string;
    status: number;
    error: string | null;
    causes: MercadoPagoErrorCause[];
  }) {
    super(params.message);
    this.name = "MercadoPagoRequestError";
    this.status = params.status;
    this.error = params.error;
    this.causes = params.causes;
  }
}

type CreateMercadoPagoCardPaymentParams = {
  accessToken: string;
  token: string;
  transactionAmount: number;
  installments: number;
  paymentMethodId: string;
  issuerId?: string | number | null;
  payer: {
    email: string;
    identification?: {
      type?: string;
      number?: string;
    };
  };
  description: string;
  externalReference: string;
  idempotencyKey: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readMercadoPagoCauses(value: unknown): MercadoPagoErrorCause[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isObject).map((cause) => ({
    code: readString(cause.code),
    description: readString(cause.description),
    data: readString(cause.data),
  }));
}

function normalizePayment(
  payload: Record<string, unknown>,
): MercadoPagoPayment {
  const id = readString(payload.id) ?? String(payload.id ?? "");
  if (!id) {
    throw new Error("Mercado Pago payment response is missing id");
  }

  return {
    id,
    status: readString(payload.status) ?? "unknown",
    statusDetail: readString(payload.status_detail),
    externalReference: readString(payload.external_reference),
    transactionAmount: readNumber(payload.transaction_amount),
    currencyId: readString(payload.currency_id),
    dateApproved: readString(payload.date_approved),
    paymentMethodId: readString(payload.payment_method_id),
  };
}

function createMercadoPagoRequestError(params: {
  fallbackMessage: string;
  status: number;
  payload: unknown;
}): MercadoPagoRequestError {
  const payload = isObject(params.payload) ? params.payload : {};
  const message =
    readString(payload.message) ??
    readString(payload.error) ??
    params.fallbackMessage;

  return new MercadoPagoRequestError({
    message,
    status: params.status,
    error: readString(payload.error),
    causes: readMercadoPagoCauses(payload.cause),
  });
}

export async function createMercadoPagoCardPayment(
  params: CreateMercadoPagoCardPaymentParams,
): Promise<MercadoPagoPayment> {
  const response = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      "content-type": "application/json",
      "X-Idempotency-Key": params.idempotencyKey,
    },
    body: JSON.stringify({
      token: params.token,
      transaction_amount: params.transactionAmount,
      installments: params.installments,
      payment_method_id: params.paymentMethodId,
      issuer_id: params.issuerId ? String(params.issuerId) : undefined,
      payer: params.payer,
      description: params.description,
      external_reference: params.externalReference,
    }),
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw createMercadoPagoRequestError({
      fallbackMessage: "Mercado Pago card payment request failed",
      status: response.status,
      payload,
    });
  }

  if (!isObject(payload)) {
    throw new Error("Mercado Pago returned an invalid payment response");
  }

  return normalizePayment(payload);
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

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw createMercadoPagoRequestError({
      fallbackMessage: "Mercado Pago payment lookup failed",
      status: response.status,
      payload,
    });
  }

  if (!isObject(payload)) {
    throw new Error("Mercado Pago returned an invalid payment response");
  }

  return normalizePayment(payload);
}

export async function findMercadoPagoPaymentByExternalReference(params: {
  accessToken: string;
  externalReference: string;
}): Promise<MercadoPagoPayment | null> {
  const url = new URL("https://api.mercadopago.com/v1/payments/search");
  url.searchParams.set("external_reference", params.externalReference);
  url.searchParams.set("sort", "date_created");
  url.searchParams.set("criteria", "desc");

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      "content-type": "application/json",
    },
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw createMercadoPagoRequestError({
      fallbackMessage: "Mercado Pago payment search failed",
      status: response.status,
      payload,
    });
  }

  if (!isObject(payload) || !Array.isArray(payload.results)) {
    return null;
  }

  const firstPayment = payload.results.find(isObject);
  return firstPayment ? normalizePayment(firstPayment) : null;
}
