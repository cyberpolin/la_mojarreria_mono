"use client";

import { useState } from "react";

export function CopySummaryButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={onCopy}
      className="h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 hover:bg-slate-700"
    >
      {copied ? "Copied" : "Copy summary"}
    </button>
  );
}
