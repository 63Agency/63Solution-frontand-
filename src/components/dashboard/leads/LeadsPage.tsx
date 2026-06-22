"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Filter, UserPlus } from "lucide-react";
import { fetchLeads } from "@/lib/leads/api-leads";
import type { ClickUpLead } from "@/lib/leads/types";
import { cn } from "@/src/lib/utils";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { LeadsTableSkeleton } from "./LeadsTableSkeleton";

function formatCreatedAt(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LeadsPage() {
  const [leads, setLeads] = useState<ClickUpLead[]>([]);
  const [total, setTotal] = useState(0);
  const [listNames, setListNames] = useState<string[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [selectedListName, setSelectedListName] = useState<string | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchLeads({
        listName: selectedListName,
        statuses: selectedStatuses,
      });

      setLeads(result.leads);
      setTotal(result.total);

      if (result.filters) {
        setListNames(result.filters.listNames);
        setStatusOptions(result.filters.statuses);
      }
    } catch (err) {
      setLeads([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : "Impossible de charger les leads.");
    } finally {
      setLoading(false);
    }
  }, [selectedListName, selectedStatuses]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    if (!statusMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!statusMenuRef.current?.contains(event.target as Node)) {
        setStatusMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [statusMenuOpen]);

  const statusLabel = useMemo(() => {
    if (selectedStatuses.length === 0) return "All statuses";
    if (selectedStatuses.length === 1) return selectedStatuses[0];
    return `${selectedStatuses.length} statuses`;
  }, [selectedStatuses]);

  const toggleStatus = (status: string) => {
    setSelectedStatuses((current) =>
      current.includes(status) ? current.filter((value) => value !== status) : [...current, status],
    );
  };

  return (
    <>
      <header className="flex shrink-0 flex-col gap-2 border-b border-zinc-800 px-6 py-5 md:px-8 md:py-6">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">ClickUp</p>
        <h1 className="text-3xl font-semibold leading-tight text-white">Leads</h1>
        <p className="max-w-xl text-sm text-zinc-400">
          Leads synchronisés depuis ClickUp via Supabase ({total} enregistrement
          {total !== 1 ? "s" : ""}).
        </p>
      </header>

      <div className="px-6 py-6 md:px-8 md:py-8">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-600/15 ring-1 ring-sky-500/25">
                <UserPlus className="size-4 text-sky-400" aria-hidden />
              </div>
              <div>
                <h2 className="text-base font-medium text-white">Pipeline</h2>
                <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                  {loading ? "Loading…" : `${total} lead${total !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div ref={statusMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setStatusMenuOpen((open) => !open)}
                  className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800/60"
                  aria-expanded={statusMenuOpen}
                  aria-haspopup="listbox"
                >
                  <Filter className="size-4 text-zinc-500" aria-hidden />
                  <span className="max-w-[10rem] truncate">{statusLabel}</span>
                  <ChevronDown className="size-4 text-zinc-500" aria-hidden />
                </button>

                {statusMenuOpen ? (
                  <div
                    className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-zinc-700 bg-zinc-950 p-2 shadow-xl"
                    role="listbox"
                    aria-label="Filter by status"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedStatuses([])}
                      className="mb-1 w-full rounded px-2 py-1.5 text-left text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    >
                      Clear status filter
                    </button>
                    {statusOptions.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-zinc-500">No statuses available</p>
                    ) : (
                      statusOptions.map((status) => {
                        const checked = selectedStatuses.includes(status);
                        return (
                          <label
                            key={status}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleStatus(status)}
                              className="size-3.5 rounded border-zinc-600 bg-zinc-900 text-sky-500"
                            />
                            <span className="truncate">{status}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedListName(null)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                selectedListName === null
                  ? "border-sky-500/50 bg-sky-500/15 text-sky-200"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200",
              )}
            >
              All lists
            </button>
            {listNames.map((listName) => (
              <button
                key={listName}
                type="button"
                onClick={() => setSelectedListName(listName)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  selectedListName === listName
                    ? "border-sky-500/50 bg-sky-500/15 text-sky-200"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200",
                )}
              >
                {listName}
              </button>
            ))}
          </div>

          {error ? (
            <p className="py-8 text-center text-sm text-red-400">{error}</p>
          ) : loading ? (
            <LeadsTableSkeleton />
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <UserPlus className="size-10 text-zinc-700" aria-hidden />
              <p className="text-sm font-medium text-zinc-300">No leads found</p>
              <p className="max-w-sm text-sm text-zinc-500">
                {selectedListName || selectedStatuses.length > 0
                  ? "Try adjusting your filters to see more results."
                  : "Leads from ClickUp will appear here once synced to Supabase."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse font-mono text-sm text-zinc-300">
                <thead>
                  <tr className="border-b border-zinc-700 text-left text-[10px] uppercase tracking-widest text-zinc-500">
                    <th className="pb-3 pr-4 font-normal">Name</th>
                    <th className="pb-3 pr-4 font-normal">Phone</th>
                    <th className="pb-3 pr-4 font-normal">Status</th>
                    <th className="pb-3 pr-4 font-normal">List name</th>
                    <th className="pb-3 font-normal">Created at</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-zinc-800 transition hover:bg-zinc-800/40"
                    >
                      <td className="py-3 pr-4 text-white">{lead.name || "—"}</td>
                      <td className="py-3 pr-4">{lead.phone || "—"}</td>
                      <td className="py-3 pr-4">
                        <LeadStatusBadge status={lead.status} />
                      </td>
                      <td className="py-3 pr-4">{lead.list_name || "—"}</td>
                      <td className="py-3 text-zinc-400">{formatCreatedAt(lead.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
