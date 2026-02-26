import { ReactNode } from "react";

type AppCardProps = {
  children: ReactNode;
  className?: string;
  as?: "article" | "section" | "div";
  id?: string;
};

const join = (...parts: Array<string | undefined>) =>
  parts.filter(Boolean).join(" ");

export function AppCard({
  children,
  className,
  as = "article",
  id,
}: AppCardProps) {
  const Tag = as;
  return (
    <Tag
      id={id}
      className={join(
        "rounded-xl border border-slate-800 bg-slate-900 p-4",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

type MetricCardProps = {
  title: string;
  value: string;
  className?: string;
};

export function MetricCard({ title, value, className }: MetricCardProps) {
  return (
    <AppCard className={className}>
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-xl font-semibold text-slate-50">{value}</p>
    </AppCard>
  );
}
