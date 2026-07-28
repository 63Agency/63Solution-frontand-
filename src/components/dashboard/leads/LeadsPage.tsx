"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Filter, Loader2, RefreshCw, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { fetchCurrentUser, getStoredUser } from "@/lib/auth/backend-login";
import { hasLeadsPermission, type UserPermissions } from "@/lib/auth/roles";
import {
  fetchLeads,
  fetchLeadsFilters,
  fetchLeadsStats,
  LEADS_PER_PAGE,
  syncLeads,
} from "@/lib/leads/api-leads";
import type {
  ClickUpLead,
  LeadListOption,
  LeadStatusOption,
  LeadsStats,
} from "@/lib/leads/types";
import { cn } from "@/src/lib/utils";
import { LeadDetailModal } from "./LeadDetailModal";
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

const filterFieldClass =
  "inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 font-mono text-[11px] uppercase tracking-widest text-zinc-200 transition hover:border-zinc-600 focus-within:border-zinc-500";

const filterDropdownClass =
  "app-scroll absolute right-0 z-20 mt-2 max-h-52 w-56 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950 p-2 shadow-xl";

type SourceListFilterProps = {
  listOptions: LeadListOption[];
  selectedListId: string | null;
  onChange: (listId: string | null) => void;
  disabled?: boolean;
};

function SourceListFilter({
  listOptions,
  selectedListId,
  onChange,
  disabled = false,
}: SourceListFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const selectedLabel = useMemo(() => {
    if (!selectedListId) return "Toutes les listes";
    const match = listOptions.find((list) => list.listId === selectedListId);
    if (!match) return selectedListId;
    return match.total != null ? `${match.label} (${match.total})` : match.label;
  }, [selectedListId, listOptions]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          filterFieldClass,
          "max-w-[18rem] normal-case",
          disabled && "cursor-not-allowed opacity-50",
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Filtrer par source / liste ClickUp"
      >
        <span className="shrink-0 text-zinc-500">Source</span>
        <span className="min-w-0 flex-1 truncate text-left text-zinc-100">{selectedLabel}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-zinc-500 transition", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div className={filterDropdownClass} role="listbox" aria-label="Liste des sources">
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={cn(
              "mb-1 w-full rounded-md px-2 py-1.5 text-left text-sm transition",
              !selectedListId
                ? "bg-zinc-800 text-white"
                : "text-zinc-300 hover:bg-zinc-800 hover:text-white",
            )}
          >
            Toutes les listes
          </button>
          {listOptions.length === 0 ? (
            <p className="px-2 py-2 text-xs text-zinc-500">Aucune liste</p>
          ) : (
            listOptions.map((list) => {
              const active = selectedListId === list.listId;
              const label =
                list.total != null ? `${list.label} (${list.total})` : list.label;
              return (
                <button
                  key={list.listId}
                  type="button"
                  onClick={() => {
                    onChange(list.listId);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full rounded-md px-2 py-1.5 text-left text-sm transition",
                    active
                      ? "bg-sky-500/15 text-sky-200"
                      : "text-zinc-300 hover:bg-zinc-800 hover:text-white",
                  )}
                >
                  <span className="block truncate">{label}</span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

export function LeadsPage() {
  const [leads, setLeads] = useState<ClickUpLead[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [listOptions, setListOptions] = useState<LeadListOption[]>([]);
  const [statusOptions, setStatusOptions] = useState<LeadStatusOption[]>([]);
  const [stats, setStats] = useState<LeadsStats | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [metaLoading, setMetaLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [canList, setCanList] = useState(true);
  const [canDetail, setCanDetail] = useState(true);
  const [canSync, setCanSync] = useState(true);
  const [canMeta, setCanMeta] = useState(true);
  const [canStats, setCanStats] = useState(true);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  const applyPermissions = useCallback((permissions?: UserPermissions | null) => {
    setCanList(hasLeadsPermission(permissions, "list"));
    setCanDetail(hasLeadsPermission(permissions, "detail"));
    setCanSync(hasLeadsPermission(permissions, "sync"));
    setCanMeta(hasLeadsPermission(permissions, "meta"));
    setCanStats(hasLeadsPermission(permissions, "stats"));
    setPermissionsReady(true);
  }, []);

  useEffect(() => {
    const stored = getStoredUser();
    applyPermissions(stored?.permissions);

    void fetchCurrentUser()
      .then(({ user }) => applyPermissions(user.permissions))
      .catch(() => {
        /* garde les permissions stockées */
      });
  }, [applyPermissions]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const loadMeta = useCallback(async () => {
    if (!canMeta) return;
    setMetaLoading(true);
    try {
      const filters = await fetchLeadsFilters();
      setListOptions(filters.lists);
      setStatusOptions(filters.statuses);
    } catch {
      /* meta optionnelle — filtres vides si indisponible */
    } finally {
      setMetaLoading(false);
    }
  }, [canMeta]);

  const loadStats = useCallback(async () => {
    if (!canStats) return;
    setStatsLoading(true);
    try {
      const nextStats = await fetchLeadsStats();
      setStats(nextStats);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [canStats]);

  const loadLeads = useCallback(async () => {
    if (!canList) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchLeads({
        listId: selectedListId,
        statuses: selectedStatuses,
        search: debouncedSearch || null,
        page: currentPage,
        pageSize: LEADS_PER_PAGE,
      });

      setLeads(result.leads);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      setLeads([]);
      setTotal(0);
      setTotalPages(1);
      setError(err instanceof Error ? err.message : "Impossible de charger les leads.");
    } finally {
      setLoading(false);
    }
  }, [canList, selectedListId, selectedStatuses, debouncedSearch, currentPage]);

  useEffect(() => {
    if (!permissionsReady) return;
    void loadStats();
  }, [permissionsReady, loadStats]);

  useEffect(() => {
    if (!permissionsReady) return;
    void loadMeta();
  }, [permissionsReady, loadMeta]);

  useEffect(() => {
    if (!permissionsReady) return;
    void loadLeads();
  }, [permissionsReady, loadLeads]);

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
      const count = opt?.total ?? stats?.byStatus[selectedStatuses[0]];
      return count != null ? `${selectedStatuses[0]} (${count})` : selectedStatuses[0];
    }
    return `${selectedStatuses.length} statuts`;
  }, [selectedStatuses, statusOptions, stats]);

  const selectedListLabel = useMemo(() => {
    if (!selectedListId) return null;
    return listOptions.find((l) => l.listId === selectedListId)?.label ?? selectedListId;
  }, [selectedListId, listOptions]);

  const pageItems = useMemo(
    () => buildPageItems(currentPage, totalPages),
    [currentPage, totalPages],
  );

  const statsCards = useMemo(() => {
    if (!stats) return [];
    const cards = [{ label: "Total", value: stats.total, color: "text-white" }];
    const topStatuses = Object.entries(stats.byStatus)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);
    const colors = ["text-sky-400", "text-emerald-400", "text-amber-400"];
    topStatuses.forEach(([status, count], index) => {
      cards.push({
        label: status,
        value: count,
        color: colors[index] ?? "text-zinc-200",
      });
    });
    return cards;
  }, [stats]);

  const toggleStatus = (status: string) => {
    setCurrentPage(1);
    setSelectedStatuses((current) =>
      current.includes(status) ? current.filter((value) => value !== status) : [...current, status],
    );
  };

  const handleSync = async () => {
    if (syncing || !canSync) return;
    setSyncing(true);
    try {
      const result = await syncLeads();
      toast.success(
        result.synced === 1
          ? "1 lead synchronisé depuis ClickUp."
          : `${result.synced} leads synchronisés depuis ClickUp.`,
      );
      await Promise.all([loadLeads(), loadStats(), loadMeta()]);
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
          Leads synchronisés depuis ClickUp ({total} enregistrement
          {total !== 1 ? "s" : ""}).
        </p>
      </header>

      <div className="px-6 py-6 md:px-8 md:py-8">
        {canStats ? (
          <section className="mb-6">
            {statsLoading && !stats ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-[88px] animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/50"
                  />
                ))}
              </div>
            ) : statsCards.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {statsCards.map((card) => (
                  <div
                    key={card.label}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4"
                  >
                    <p className="truncate text-[11px] uppercase tracking-wider text-zinc-500">
                      {card.label}
                    </p>
                    <p className={cn("mt-1 text-2xl font-bold tabular-nums", card.color)}>
                      {card.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-600/15 ring-1 ring-sky-500/25">
                <UserPlus className="size-4 text-sky-400" aria-hidden />
              </div>
              <div>
                <h2 className="text-base font-medium text-white">Pipeline</h2>
                <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                  {loading ? "Chargement…" : `${total} lead${total !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {canSync ? (
                <button
                  type="button"
                  onClick={() => void handleSync()}
                  disabled={syncing}
                  className="inline-flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-600/15 px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-sky-200 transition hover:bg-sky-600/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {syncing ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw className="size-4" aria-hidden />
                  )}
                  {syncing ? "Synchronisation…" : "Synchroniser ClickUp"}
                </button>
              ) : null}

              {canList ? (
                <label
                  className={cn(
                    filterFieldClass,
                    "normal-case rounded-full px-4",
                  )}
                >
                  <Search className="size-4 shrink-0 text-zinc-500" aria-hidden />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => {
                      setCurrentPage(1);
                      setSearchQuery(e.target.value);
                    }}
                    placeholder="Rechercher…"
                    className="w-36 border-0 bg-transparent text-sm normal-case text-zinc-100 outline-none placeholder:text-zinc-500 sm:w-44"
                    aria-label="Rechercher un lead"
                  />
                </label>
              ) : null}

              {canMeta ? (
                <SourceListFilter
                  listOptions={listOptions}
                  selectedListId={selectedListId}
                  disabled={metaLoading}
                  onChange={(listId) => {
                    setCurrentPage(1);
                    setSelectedListId(listId);
                  }}
                />
              ) : null}

              {canMeta ? (
                <div ref={statusMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setStatusMenuOpen((open) => !open)}
                    className={cn(filterFieldClass, "normal-case hover:bg-zinc-800/60")}
                    aria-expanded={statusMenuOpen}
                    aria-haspopup="listbox"
                  >
                    <Filter className="size-4 text-zinc-500" aria-hidden />
                    <span className="max-w-[10rem] truncate">{statusLabel}</span>
                    <ChevronDown className="size-4 text-zinc-500" aria-hidden />
                  </button>

                  {statusMenuOpen ? (
                    <div
                      className={filterDropdownClass}
                      role="listbox"
                      aria-label="Filtrer par statut"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentPage(1);
                          setSelectedStatuses([]);
                        }}
                        className="mb-1 w-full rounded-md px-2 py-1.5 text-left text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
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
                              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleStatus(status.value)}
                                className="size-3.5 rounded border-zinc-600 bg-zinc-900 text-sky-500"
                              />
                              <span className="min-w-0 flex-1 truncate">{status.value}</span>
                              {status.total != null ? (
                                <span className="shrink-0 tabular-nums text-xs text-zinc-500">
                                  {status.total}
                                </span>
                              ) : null}
                            </label>
                          );
                        })
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {!canList ? (
            <p className="py-8 text-center text-sm text-zinc-400">
              Vous n&apos;avez pas la permission d&apos;afficher la liste des leads.
            </p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-400">{error}</p>
          ) : loading ? (
            <LeadsTableSkeleton rows={LEADS_PER_PAGE} />
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <UserPlus className="size-10 text-zinc-700" aria-hidden />
              <p className="text-sm font-medium text-zinc-300">Aucun lead trouvé</p>
              <p className="max-w-sm text-sm text-zinc-500">
                {selectedListId || selectedStatuses.length > 0 || debouncedSearch
                  ? "Essayez d'ajuster vos filtres pour voir plus de résultats."
                  : "Les leads ClickUp apparaîtront ici une fois synchronisés."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse font-mono text-sm text-zinc-300">
                  <thead>
                    <tr className="border-b border-zinc-700 text-left text-[10px] uppercase tracking-widest text-zinc-500">
                      <th className="pb-3 pr-4 font-normal">Nom</th>
                      <th className="pb-3 pr-4 font-normal">Téléphone</th>
                      <th className="pb-3 pr-4 font-normal">Statut</th>
                      <th className="pb-3 pr-4 font-normal">Source</th>
                      <th className="pb-3 font-normal">Créé le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr
                        key={lead.id}
                        onClick={() => {
                          if (canDetail) setSelectedLeadId(lead.id);
                        }}
                        className={cn(
                          "border-b border-zinc-800 transition hover:bg-zinc-800/40",
                          canDetail && "cursor-pointer",
                        )}
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

      {canDetail ? (
        <LeadDetailModal leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />
      ) : null}
    </>
  );
}
