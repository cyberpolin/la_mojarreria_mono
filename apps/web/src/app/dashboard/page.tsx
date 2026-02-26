import { OperationalDashboardClient } from "@/components/dashboard/operational-dashboard-client";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function DashboardPage({ searchParams }: PageProps) {
  const selectedDate = firstParam(searchParams?.date) ?? todayISO();
  return <OperationalDashboardClient initialDate={selectedDate} />;
}
