"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-slate-950 text-white hover:bg-slate-800",
        variant === "secondary" &&
          "border border-slate-300 bg-white text-slate-900 hover:border-slate-950",
        variant === "ghost" && "text-slate-700 hover:bg-slate-100",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 md:p-6">
      {children}
    </article>
  );
}
