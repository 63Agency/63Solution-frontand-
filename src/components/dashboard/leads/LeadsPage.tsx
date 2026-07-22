"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Filter, Loader2, RefreshCw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { getStoredUser } from "@/lib/auth/backend-login";
import { isFullAdminRole } from "@/lib/auth/roles";
import { fetchLeads, LEADS_PER_PAGE } from "@/lib/leads/api-leads";
import { syncClickUpLeads } from "@/lib/leads/backend-clickup";
import type {
  ClickUpLead,
  LeadListOption,
  LeadStatusOption,
} from "@/lib/leads/types";
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

function buildPageItems(currentPage: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 3) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: (number | "...")[] = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  if (start > 2) items.push("...");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < totalPages - 1) items.push("...");
  items.push(totalPages);
  return items;
}

export function LeadsPage() {
  const [leads, setLeads] = useState<ClickUpLead[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [listOptions, setListOptions] = useState<LeadListOption[]>([]);
  const [statusOptions, setStatusOptions] = useState<LeadStatusOption[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = getStoredUser();
    setIsAdmin(user ? isFullAdminRole(user.role) : false);
  }, []);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchLeads({
        listId: selectedListId,
        statuses: selectedStatuses,
        page: currentPage,
        pageSize: LEADS_PER_PAGE,
      });

      setLeads(result.leads);
      setTotal(result.total);
      setTotalPages(result.totalPages);

      if (result.filters) {
        setListOptions(result.filters.lists ?? []);
        setStatusOptions(result.filters.statuses ?? []);
      }
    } catch (err) {
      setLeads([]);
      setTotal(0);
      setTotalPages(1);
      setError(err instanceof Error ? err.message : "Impossible de charger les leads.");
    } finally {
      setLoading(false);
    }
  }, [selectedListId, selectedStatuses, currentPage]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
    if (selectedStatuses.length === 0) return "Tous les statuts";
    if (selectedStatuses.length === 1) {
      const opt = statusOptions.find((s) => s.value === selectedStatuses[0]);
      return opt ? `${opt.value} (${opt.total})` : selectedStatuses[0];
    }
    return `${selectedStatuses.length} statuts`;
  }, [selectedStatuses, statusOptions]);

  const selectedListLabel = useMemo(() => {
    if (!selectedListId) return null;
    return listOptions.find((l) => l.listId === selectedListId)?.label ?? selectedListId;
  }, [selectedListId, listOptions]);

  const pageItems = useMemo(
    () => buildPageItems(currentPage, totalPages),
    [currentPage, totalPages],
  );

  const toggleStatus = (status: string) => {
    setCurrentPage(1);
    setSelectedStatuses((current) =>
      current.includes(status) ? current.filter((value) => value !== status) : [...current, status],
    );
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await syncClickUpLeads();
      toast.success(
        result.synced === 1
          ? "1 lead synchronisé depuis ClickUp."
          : `${result.synced} leads synchronisés depuis ClickUp.`,
      );
      await loadLeads();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Synchronisation ClickUp impossible.");
    } finally {
      setSyncing(false);
    }
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
        <section>
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
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => void handleSync()}
                  disabled={syncing}
                  className="inline-flex items-center gap-2 border border-sky-500/40 bg-sky-600/15 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-sky-200 transition hover:bg-sky-600/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {syncing ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw className="size-4" aria-hidden />
                  )}
                  {syncing ? "Synchronisation…" : "Sync ClickUp"}
                </button>
              ) : null}

              <label className="inline-flex items-center gap-2 border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-zinc-200">
                <span className="text-zinc-500">Source</span>
                <select
                  value={selectedListId ?? ""}
                  onChange={(e) => {
                    setCurrentPage(1);
                    setSelectedListId(e.target.value || null);
                  }}
                  className="max-w-[18rem] border-0 bg-transparent text-zinc-100 outline-none"
                  aria-label="Filtrer par source / liste ClickUp"
                >
                  <option value="">Toutes les listes</option>
                  {listOptions.map((list) => (
                    <option key={list.listId} value={list.listId}>
                      {list.label} ({list.total})
                    </option>
                  ))}
                </select>
              </label>

              <div ref={statusMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setStatusMenuOpen((open) => !open)}
                  className="inline-flex items-center gap-2 border border-zinc-700 bg-zinc-900 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-zinc-200 transition hover:bg-zinc-800/60"
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
                      onClick={() => {
                        setCurrentPage(1);
                        setSelectedStatuses([]);
                      }}
                      className="mb-1 w-full rounded px-2 py-1.5 text-left text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    >
                      Tous les statuts
                    </button>
                    {statusOptions.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-zinc-500">Aucun statut</p>
                    ) : (
                      statusOptions.map((status) => {
                        const checked = selectedStatuses.includes(status.value);
                        return (
                          <label
                            key={status.value}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleStatus(status.value)}
                              className="size-3.5 rounded border-zinc-600 bg-zinc-900 text-sky-500"
                            />
                            <span className="min-w-0 flex-1 truncate">{status.value}</span>
                            <span className="shrink-0 tabular-nums text-xs text-zinc-500">
                              {status.total}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {error ? (
            <p className="py-8 text-center text-sm text-red-400">{error}</p>
          ) : loading ? (
            <LeadsTableSkeleton rows={LEADS_PER_PAGE} />
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <UserPlus className="size-10 text-zinc-700" aria-hidden />
              <p className="text-sm font-medium text-zinc-300">No leads found</p>
              <p className="max-w-sm text-sm text-zinc-500">
                {selectedListId || selectedStatuses.length > 0
                  ? "Try adjusting your filters to see more results."
                  : "Leads from ClickUp will appear here once synced to Supabase."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse font-mono text-sm text-zinc-300">
                  <thead>
                    <tr className="border-b border-zinc-700 text-left text-[10px] uppercase tracking-widest text-zinc-500">
                      <th className="pb-3 pr-4 font-normal">Name</th>
                      <th className="pb-3 pr-4 font-normal">Phone</th>
                      <th className="pb-3 pr-4 font-normal">Status</th>
                      <th className="pb-3 pr-4 font-normal">Source</th>
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
                        <td className="py-3 pr-4">
                          {lead.list_name ? (
                            <span className="inline-flex max-w-[12rem] truncate rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-300">
                              {lead.list_name}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3 text-zinc-400">{formatCreatedAt(lead.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-3 font-mono text-[11px] uppercase tracking-widest text-zinc-400">
                <p>
                  Page {currentPage} / {totalPages} — {total} lead{total !== 1 ? "s" : ""}
                  {selectedListLabel ? ` · ${selectedListLabel}` : ""}
                  {" · "}
                  {LEADS_PER_PAGE}/page
                </p>
                {totalPages > 1 ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                      className="rounded border border-zinc-700 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Précédent
                    </button>
                    {pageItems.map((item, idx) =>
                      item === "..." ? (
                        <span key={`dots-${idx}`} className="px-1 text-zinc-500">
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setCurrentPage(item)}
                          className={cn(
                            "rounded border px-2.5 py-1.5",
                            item === currentPage
                              ? "border-zinc-500 bg-zinc-800 text-white"
                              : "border-zinc-700 text-zinc-300 hover:bg-zinc-800",
                          )}
                        >
                          {item}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded border border-zinc-700 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Suivant
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
