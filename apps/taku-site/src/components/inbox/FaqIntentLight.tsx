export function FaqIntentLight({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span
      className="mb-2 h-3 w-3 shrink-0 rounded-full bg-emerald-500"
      title="Semaforo verde: horarios, ubicacion o costo de envio"
      aria-label="Semaforo verde: horarios, ubicacion o costo de envio"
    />
  );
}
