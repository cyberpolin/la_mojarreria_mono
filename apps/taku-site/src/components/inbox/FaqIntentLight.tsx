import { cx } from "./helpers";

export function FaqIntentLight({
  visible,
  className,
}: {
  visible: boolean;
  className?: string;
}) {
  if (!visible) return null;
  return (
    <span
      className={cx(
        "inline-block h-3.5 w-3.5 shrink-0 rounded-full bg-emerald-500 ring-2 ring-white",
        className,
      )}
      title="Semaforo verde: horarios, ubicacion o costo de envio"
      aria-label="Semaforo verde: horarios, ubicacion o costo de envio"
    />
  );
}
