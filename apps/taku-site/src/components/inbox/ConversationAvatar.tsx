import { cx } from "./helpers";

export function MotoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-4 w-4"}
      aria-hidden="true"
    >
      <circle cx="6" cy="17" r="2.4" />
      <circle cx="18" cy="17" r="2.4" />
      <path d="M8.4 17h4.2l2.2-5.2H8.8L7.4 17" />
      <path d="M14.8 11.8h3.1l1.6 3.4" />
      <path d="M10.2 11.8 8.6 8.6H6.4" />
    </svg>
  );
}

export function ConversationAvatar({
  label,
  isDriver = false,
  size = "md",
  tone = "light",
}: {
  label: string;
  isDriver?: boolean;
  size?: "sm" | "md";
  tone?: "light" | "dark";
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <div
        className={cx(
          "grid place-items-center rounded-full font-semibold",
          size === "sm" ? "h-9 w-9 text-sm" : "h-12 w-12 text-base",
          tone === "dark"
            ? "bg-slate-700 text-white"
            : "bg-slate-300 text-slate-700",
        )}
      >
        {label.slice(0, 1).toUpperCase() || "?"}
      </div>
      {isDriver ? (
        <span
          className={cx(
            "grid place-items-center",
            tone === "dark" ? "text-white" : "text-slate-700",
          )}
          title="Repartidor"
          aria-label="Repartidor"
        >
          <MotoIcon className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
        </span>
      ) : null}
    </div>
  );
}
