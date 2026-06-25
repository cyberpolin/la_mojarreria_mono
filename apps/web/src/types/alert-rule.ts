export type AlertMetric = "LOW_MOJARRAS";

export type AlertRuleRecord = {
  id: string;
  name: string;
  metric: AlertMetric;
  enabled: boolean;
  threshold: number;
  recipient: string;
  messageTemplate: string;
  botHandlerId: string;
  cooldownMinutes: number;
  lastTriggeredAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AlertRuleInput = {
  name: string;
  metric: AlertMetric;
  enabled: boolean;
  threshold: number;
  recipient: string;
  messageTemplate: string;
  botHandlerId: string;
  cooldownMinutes: number;
};

export type MojarrasInventorySnapshot = {
  bought: number;
  sold: number;
  remaining: number;
};

export type AlertEvaluationResult = {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  skippedReason?: string;
  remaining: number;
  threshold: number;
  sentStatus?: number;
};

export type AlertRulesPayload = {
  rules: AlertRuleRecord[];
  inventory: MojarrasInventorySnapshot;
};
