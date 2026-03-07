import { Suspense } from "react";
import CostControlClient from "./CostControlClient";

function LoadingState() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center px-6 py-12 text-sm text-slate-400">
      Loading cost control…
    </div>
  );
}

export default function CostControlPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CostControlClient />
    </Suspense>
  );
}
