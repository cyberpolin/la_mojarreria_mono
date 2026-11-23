"use client";

export function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="sr-only">Search chats</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search name, number, or message"
        className="h-11 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-slate-500"
      />
    </label>
  );
}
