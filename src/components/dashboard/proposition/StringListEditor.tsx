"use client";

import { Plus, Trash2 } from "lucide-react";

const labelClass = "block text-[11px] font-semibold uppercase tracking-wide text-zinc-400";

type Props = {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  minItems?: number;
};

export function StringListEditor({
  label,
  items,
  onChange,
  placeholder = "Nouvel élément…",
  minItems = 1,
}: Props) {
  const patchAt = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    onChange(next);
  };

  const removeAt = (index: number) => {
    if (items.length <= minItems) return;
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={labelClass}>{label}</span>
        <button
          type="button"
          onClick={() => onChange([...items, ""])}
          className="inline-flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 font-mono text-[10px] uppercase text-zinc-300 hover:bg-zinc-800"
        >
          <Plus className="size-3" aria-hidden />
          Ajouter
        </button>
      </div>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={`item-${index}`} className="flex gap-2">
            <input
              type="text"
              className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500"
              value={item}
              onChange={(e) => patchAt(index, e.target.value)}
              placeholder={placeholder}
            />
            <button
              type="button"
              onClick={() => removeAt(index)}
              disabled={items.length <= minItems}
              className="shrink-0 rounded border border-red-700/50 p-1.5 text-red-300 hover:bg-red-900/30 disabled:opacity-30"
              aria-label="Supprimer"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
