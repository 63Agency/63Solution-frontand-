const STATUS_STYLES: Record<string, string> = {
  new: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  nouveau: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  open: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  contacted: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  contacté: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  qualified: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  qualifié: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  won: "bg-emerald-600/20 text-emerald-200 ring-emerald-500/40",
  gagné: "bg-emerald-600/20 text-emerald-200 ring-emerald-500/40",
  lost: "bg-red-500/15 text-red-300 ring-red-500/30",
  perdu: "bg-red-500/15 text-red-300 ring-red-500/30",
  closed: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30",
  fermé: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30",
};

const DEFAULT_STYLE = "bg-zinc-700/40 text-zinc-300 ring-zinc-600/40";

export function leadStatusBadgeClass(status: string): string {
  const key = status.trim().toLowerCase();
  return STATUS_STYLES[key] ?? DEFAULT_STYLE;
}
