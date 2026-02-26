import { DashboardActionable, DashboardAlert } from "@/types/dashboard";

export const generateActionables = (
  alerts: DashboardAlert[],
): DashboardActionable[] => {
  const mapped = alerts.map((alert) => ({
    id: `action-${alert.id}`,
    title: alert.title,
    detail: alert.description,
    actionLabel: alert.actionLabel,
    actionTarget: alert.actionTarget,
  }));

  return mapped.slice(0, 7);
};

export const getActionablesStorageKey = (date: string) =>
  `MOJARRERIA_ACTIONABLES_DONE_${date}`;
