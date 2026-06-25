import {
  AlertEvaluationResult,
  AlertRuleInput,
  AlertRuleRecord,
  AlertRulesPayload,
  MojarrasInventorySnapshot,
} from "@/types/alert-rule";
import { BotHandlersPayload } from "@/types/bot-handler";
import { getBotHandlerForDelivery, getBotHandlers } from "@/lib/bot-handlers";
import { fetchCloseReports } from "@/lib/close-reports";
import { getExpenses } from "@/lib/expenses";
import { buildAuthHeaders } from "@/lib/web-auth.server";

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

const MOJARRAS_CONCEPT = "mojarras";
const MOJARRAS_QUANTITY_LABEL = "Mojarras quantity";

const getEndpoint = () =>
  process.env.KEYSTONE_GRAPHQL_URL ??
  process.env.NEXT_PUBLIC_KEYSTONE_GRAPHQL_URL ??
  "http://localhost:3000/api/graphql";

async function execute<T>(query: string, variables?: Record<string, unknown>) {
  const response = await fetch(getEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...buildAuthHeaders() },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed (${response.status})`);
  }

  const payload = (await response.json()) as GraphQLResponse<T>;
  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? "Unknown GraphQL error");
  }
  if (!payload.data) throw new Error("Missing data in GraphQL response");
  return payload.data;
}

const normalizeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const getMojarrasQuantityFromNotes = (notes: string) => {
  const match = notes.match(/Mojarras quantity:\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
};

const buildRuleData = (input: AlertRuleInput) => ({
  name: input.name.trim(),
  metric: input.metric,
  enabled: input.enabled,
  threshold: Number(input.threshold),
  recipient: input.recipient.trim(),
  messageTemplate: input.messageTemplate.trim(),
  botHandlerId: input.botHandlerId.trim(),
  cooldownMinutes: Number(input.cooldownMinutes),
});

const replaceTemplate = (
  template: string,
  rule: AlertRuleRecord,
  inventory: MojarrasInventorySnapshot,
) =>
  template
    .replaceAll("{remaining}", String(inventory.remaining))
    .replaceAll("{threshold}", String(rule.threshold))
    .replaceAll("{bought}", String(inventory.bought))
    .replaceAll("{sold}", String(inventory.sold))
    .replaceAll("{rule}", rule.name);

export const getMojarrasInventory = async () => {
  const [expensesPayload, closeReportsPayload] = await Promise.all([
    getExpenses({ take: 365 }),
    fetchCloseReports({ take: 365 }),
  ]);

  const bought = expensesPayload.expenses
    .filter((expense) => normalizeName(expense.concept) === MOJARRAS_CONCEPT)
    .reduce(
      (sum, expense) => sum + getMojarrasQuantityFromNotes(expense.notes),
      0,
    );

  const sold = closeReportsPayload.reports.reduce((total, report) => {
    return (
      total +
      report.items.reduce((itemTotal, item) => {
        return normalizeName(item.name).includes(MOJARRAS_CONCEPT)
          ? itemTotal + item.qty
          : itemTotal;
      }, 0)
    );
  }, 0);

  return { bought, sold, remaining: bought - sold };
};

export const getAlertRules = async (): Promise<AlertRulesPayload> => {
  const query = `
    query AlertRules {
      alertRules(orderBy: [{ updatedAt: desc }], take: 100) {
        id
        name
        metric
        enabled
        threshold
        recipient
        messageTemplate
        botHandlerId
        cooldownMinutes
        lastTriggeredAt
        createdAt
        updatedAt
      }
    }
  `;
  const [data, inventory] = await Promise.all([
    execute<{ alertRules: AlertRuleRecord[] }>(query),
    getMojarrasInventory(),
  ]);

  return {
    rules: data.alertRules ?? [],
    inventory,
  };
};

export const getAlertSetupOptions = async (): Promise<
  AlertRulesPayload & BotHandlersPayload
> => {
  const [rulesPayload, handlersPayload] = await Promise.all([
    getAlertRules(),
    getBotHandlers(),
  ]);

  return { ...rulesPayload, handlers: handlersPayload.handlers };
};

export const createAlertRule = async (input: AlertRuleInput) => {
  const mutation = `
    mutation CreateAlertRule($data: AlertRuleCreateInput!) {
      createAlertRule(data: $data) { id }
    }
  `;

  await execute(mutation, { data: buildRuleData(input) });
};

export const updateAlertRule = async (id: string, input: AlertRuleInput) => {
  const mutation = `
    mutation UpdateAlertRule(
      $where: AlertRuleWhereUniqueInput!
      $data: AlertRuleUpdateInput!
    ) {
      updateAlertRule(where: $where, data: $data) { id }
    }
  `;

  await execute(mutation, {
    where: { id },
    data: buildRuleData(input),
  });
};

export const deleteAlertRule = async (id: string) => {
  const mutation = `
    mutation DeleteAlertRule($where: AlertRuleWhereUniqueInput!) {
      deleteAlertRule(where: $where) { id }
    }
  `;

  await execute(mutation, { where: { id } });
};

const markRuleTriggered = async (id: string, triggeredAt: Date) => {
  const mutation = `
    mutation MarkAlertRuleTriggered(
      $where: AlertRuleWhereUniqueInput!
      $data: AlertRuleUpdateInput!
    ) {
      updateAlertRule(where: $where, data: $data) { id }
    }
  `;

  await execute(mutation, {
    where: { id },
    data: { lastTriggeredAt: triggeredAt.toISOString() },
  });
};

export const evaluateAlertRules = async ({
  force = false,
}: {
  force?: boolean;
} = {}): Promise<{
  inventory: MojarrasInventorySnapshot;
  results: AlertEvaluationResult[];
}> => {
  const { rules, inventory } = await getAlertRules();
  const now = new Date();
  const results: AlertEvaluationResult[] = [];

  for (const rule of rules) {
    const baseResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      remaining: inventory.remaining,
      threshold: rule.threshold,
    };

    if (!rule.enabled) {
      results.push({
        ...baseResult,
        triggered: false,
        skippedReason: "disabled",
      });
      continue;
    }

    if (rule.metric !== "LOW_MOJARRAS") {
      results.push({
        ...baseResult,
        triggered: false,
        skippedReason: "unsupported_metric",
      });
      continue;
    }

    if (inventory.remaining >= rule.threshold) {
      results.push({
        ...baseResult,
        triggered: false,
        skippedReason: "threshold_not_met",
      });
      continue;
    }

    if (!force && rule.lastTriggeredAt) {
      const lastTriggeredAt = new Date(rule.lastTriggeredAt);
      const nextAllowedAt =
        lastTriggeredAt.getTime() + rule.cooldownMinutes * 60_000;
      if (now.getTime() < nextAllowedAt) {
        results.push({
          ...baseResult,
          triggered: false,
          skippedReason: "cooldown",
        });
        continue;
      }
    }

    const handler = await getBotHandlerForDelivery(rule.botHandlerId);
    if (!handler?.enabled || !handler.webhookUrl?.trim()) {
      results.push({
        ...baseResult,
        triggered: false,
        skippedReason: "handler_unavailable",
      });
      continue;
    }

    const response = await fetch(handler.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(handler.apiKeySecret?.trim()
          ? { Authorization: `Bearer ${handler.apiKeySecret.trim()}` }
          : {}),
      },
      body: JSON.stringify({
        event: "alert.triggered",
        recipient: rule.recipient,
        message: replaceTemplate(rule.messageTemplate, rule, inventory),
        alert: {
          id: rule.id,
          name: rule.name,
          metric: rule.metric,
          threshold: rule.threshold,
        },
        inventory,
        sentAt: now.toISOString(),
      }),
    });

    if (!response.ok) {
      results.push({
        ...baseResult,
        triggered: false,
        skippedReason: "delivery_failed",
        sentStatus: response.status,
      });
      continue;
    }

    await markRuleTriggered(rule.id, now);
    results.push({
      ...baseResult,
      triggered: true,
      sentStatus: response.status,
    });
  }

  return { inventory, results };
};
