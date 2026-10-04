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
        "h-3 w-3 shrink-0 rounded-full bg-emerald-500",
        className ?? "mb-2",
      )}
      title="Semaforo verde: horarios, ubicacion o costo de envio"
      aria-label="Semaforo verde: horarios, ubicacion o costo de envio"
    />
  );
}
