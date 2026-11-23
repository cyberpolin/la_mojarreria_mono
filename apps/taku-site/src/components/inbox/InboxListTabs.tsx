import { cx } from "./helpers";

export type InboxListTab = "chats" | "pedidos";

export function InboxListTabs({
  value,
  onChange,
  tone = "light",
}: {
  value: InboxListTab;
  onChange: (tab: InboxListTab) => void;
  tone?: "light" | "dark";
}) {
  const tabs: Array<{ id: InboxListTab; label: string }> = [
    { id: "chats", label: "Chats" },
    { id: "pedidos", label: "Pedidos" },
  ];

  return (
    <div
      className={cx(
        "grid grid-cols-2",
        tone === "dark" ? "bg-slate-900" : "bg-white",
      )}
    >
      {tabs.map((tab) => {
        const selected = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cx(
              "min-h-11 border-b-2 text-sm font-semibold",
              selected && tone === "dark" && "border-white text-white",
              selected && tone === "light" && "border-slate-950 text-slate-950",
              !selected &&
                tone === "dark" &&
                "border-transparent text-slate-400",
              !selected &&
                tone === "light" &&
                "border-transparent text-slate-400",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
