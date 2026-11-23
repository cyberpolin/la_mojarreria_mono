import { cx } from "@/components/inbox/helpers";

function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "grid h-5 w-5 place-items-center rounded border",
        checked
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-400 bg-white text-transparent",
      )}
    >
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5">
        <path
          fill="currentColor"
          d="M7.7 13.3 4.9 10.5l-1.2 1.2 4 4 8-8-1.2-1.2z"
        />
      </svg>
    </span>
  );
}

export function CheckOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
}) {
  const interactive = Boolean(onChange);
  return (
    <label
      className={cx(
        "flex min-h-11 items-center gap-3 text-sm font-medium text-slate-700",
        interactive &&
          "cursor-pointer hover:text-slate-950 focus-within:text-slate-950",
      )}
    >
      {interactive ? (
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange?.(event.target.checked)}
          className="sr-only"
        />
      ) : null}
      <CheckMark checked={checked} />
      <span>{label}</span>
    </label>
  );
}
