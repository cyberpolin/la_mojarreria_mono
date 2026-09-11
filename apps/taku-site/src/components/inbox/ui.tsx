import type { KeyboardEvent, ReactNode } from "react";
import { cx } from "./helpers";

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "dark" | "warn" | "danger";
}) {
  return (
    <span
      className={cx(
        "inline-flex min-h-7 items-center rounded-full px-3 text-xs font-semibold",
        tone === "dark" && "bg-slate-950 text-white",
        tone === "warn" && "border border-slate-300 bg-white text-slate-800",
        tone === "danger" &&
          "border border-slate-400 bg-slate-100 text-slate-900",
        tone === "default" && "bg-slate-100 text-slate-700",
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  type = "button",
  disabled,
  onClick,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-slate-950 text-white hover:bg-slate-800",
        variant === "secondary" &&
          "border border-slate-300 bg-white text-slate-900 hover:border-slate-950",
        variant === "ghost" && "text-slate-700 hover:bg-slate-100",
      )}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      {label}
      {children}
      {hint ? (
        <span className="text-xs font-normal text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({
  placeholder,
  readOnly,
  value,
  onChange,
  type = "text",
}: {
  placeholder: string;
  readOnly?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      readOnly={readOnly}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200 read-only:bg-slate-100"
    />
  );
}

export function TextArea({
  placeholder,
  rows = 4,
  value,
  onChange,
  readOnly,
  disabled,
  onKeyDown,
}: {
  placeholder: string;
  rows?: number;
  value?: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <textarea
      rows={rows}
      readOnly={readOnly}
      disabled={disabled}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      onKeyDown={onKeyDown}
      className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200 read-only:bg-slate-100 disabled:bg-slate-100"
    />
  );
}

export function Select({
  children,
  value,
  onChange,
  disabled,
}: {
  children: ReactNode;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.value)}
      className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200 disabled:bg-slate-100"
    >
      {children}
    </select>
  );
}

export function Switch({
  checked = false,
  label,
  disabled,
  onChange,
}: {
  checked?: boolean;
  label: string;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label
      className={cx(
        "flex min-h-11 items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        className="sr-only"
      />
      <span
        className={cx(
          "flex h-6 w-11 items-center rounded-full p-1",
          checked ? "justify-end bg-slate-950" : "justify-start bg-slate-300",
        )}
      >
        <span className="h-4 w-4 rounded-full bg-white" />
      </span>
    </label>
  );
}
