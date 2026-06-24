"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckSquare,
  ChevronDown,
  Filter,
  Loader2,
  Search,
  Square,
  UserPlus,
  X,
} from "lucide-react";
import { fetchLeadsForImport } from "@/lib/leads/api-leads";
import type { ClickUpLead } from "@/lib/leads/types";
import { LeadStatusBadge } from "@/src/components/dashboard/leads/LeadStatusBadge";
import { cn } from "@/src/lib/utils";
import { formatWhatsAppPhone } from "./whatsapp-utils";

type Props = {
  open: boolean;
  onClose: () => void;
  onImport: (phones: string[]) => void;
};

type MultiSelectFilterProps = {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  placeholder: string;
};

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder,
}: MultiSelectFilterProps) {
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

  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  };

  const summary =
    selected.size === 0
      ? placeholder
      : selected.size === 1
        ? [...selected][0]
        : `${selected.size} sélectionné${selected.size > 1 ? "s" : ""}`;

  return (
    <div ref={ref} className="relative">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-left text-sm text-zinc-100 hover:border-zinc-600"
        aria-expanded={open}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-zinc-500 transition", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="absolute left-0 right-0 z-20 mt-2 max-h-52 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950 p-2 shadow-xl">
          <button
            type="button"
            onClick={() => onChange(new Set())}
            className="mb-1 w-full rounded px-2 py-1.5 text-left text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            Tout effacer
          </button>
          {options.length === 0 ? (
            <p className="px-2 py-2 text-xs text-zinc-500">Aucune option</p>
          ) : (
            options.map((option) => {
              const checked = selected.has(option);
              return (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(option)}
                    className="size-3.5 rounded border-zinc-600 bg-zinc-900 text-sky-500"
                  />
                  <span className="truncate">{option}</span>
                </label>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

function leadMatchesSearch(lead: ClickUpLead, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const name = lead.name.toLowerCase();
  const phoneRaw = (lead.phone ?? "").toLowerCase();
  const phoneDigits = phoneRaw.replace(/\D/g, "");
  const qDigits = q.replace(/\D/g, "");

  if (name.includes(q)) return true;
  if (phoneRaw.includes(q)) return true;
  if (qDigits.length >= 3 && phoneDigits.includes(qDigits)) return true;
  return false;
}

export function BulkSendLeadsImportModal({ open, onClose, onImport }: Props) {
  const [allLeads, setAllLeads] = useState<ClickUpLead[]>([]);
  const [listNames, setListNames] = useState<string[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchLeadsForImport();
      setAllLeads(result.leads);
      setListNames(result.filters?.listNames ?? []);
      setStatusOptions(result.filters?.statuses ?? []);
    } catch (e) {
      setAllLeads([]);
      setError(e instanceof Error ? e.message : "Impossible de charger les leads.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    setSearch("");
    setSelectedLists(new Set());
    setSelectedStatuses(new Set());
    setSelectedIds(new Set());
    void loadLeads();
  }, [open, loadLeads]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const filteredLeads = useMemo(() => {
    return allLeads.filter((lead) => {
      if (selectedLists.size > 0 && !selectedLists.has(lead.list_name)) return false;
      if (selectedStatuses.size > 0 && !selectedStatuses.has(lead.status)) return false;
      return leadMatchesSearch(lead, search);
    });
  }, [allLeads, search, selectedLists, selectedStatuses]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count += 1;
    if (selectedLists.size > 0) count += 1;
    if (selectedStatuses.size > 0) count += 1;
    return count;
  }, [search, selectedLists.size, selectedStatuses.size]);

  const selectedInFilterCount = useMemo(
    () => filteredLeads.filter((lead) => selectedIds.has(lead.id)).length,
    [filteredLeads, selectedIds],
  );

  const selectedPhones = useMemo(
    () =>
      allLeads
        .filter((lead) => selectedIds.has(lead.id) && lead.phone?.trim())
        .map((lead) => lead.phone!.trim()),
    [allLeads, selectedIds],
  );

  const allFilteredSelected =
    filteredLeads.length > 0 && filteredLeads.every((lead) => selectedIds.has(lead.id));

  const toggleLead = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(allLeads.map((lead) => lead.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const selectAllFiltered = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const lead of filteredLeads) next.add(lead.id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const lead of filteredLeads) next.delete(lead.id);
        return next;
      });
    } else {
      selectAllFiltered();
    }
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedLists(new Set());
    setSelectedStatuses(new Set());
  };

  const handleImport = () => {
    if (selectedPhones.length === 0) return;
    onImport(selectedPhones);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-import-leads-title"
        className="flex max-h-[min(92vh,880px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950 shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-600/15 ring-1 ring-sky-500/25">
              <UserPlus className="size-4 text-sky-400" aria-hidden />
            </div>
            <div>
              <h3 id="bulk-import-leads-title" className="text-lg font-semibold text-white">
                Importer depuis les Leads
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                Recherchez, filtrez et sélectionnez les contacts ClickUp avec téléphone.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Fermer"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-4 border-b border-zinc-800 px-6 py-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou numéro…"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-600/80 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
            />
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-zinc-500" aria-hidden />
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Filtres
                </span>
                {activeFiltersCount > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300 ring-1 ring-sky-500/30">
                    {activeFiltersCount}
                  </span>
                ) : null}
              </div>
              {activeFiltersCount > 0 ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Réinitialiser les filtres
                </button>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <MultiSelectFilter
                label="Liste"
                options={listNames}
                selected={selectedLists}
                onChange={setSelectedLists}
                placeholder="Toutes les listes"
              />
              <MultiSelectFilter
                label="Statut"
                options={statusOptions}
                selected={selectedStatuses}
                onChange={setSelectedStatuses}
                placeholder="Tous les statuts"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 bg-zinc-900/30 px-6 py-3">
          <p className="text-sm text-zinc-300">
            <span className="font-semibold text-white">{selectedInFilterCount}</span> lead
            {selectedInFilterCount !== 1 ? "s" : ""} sélectionné
            {selectedInFilterCount !== 1 ? "s" : ""} sur{" "}
            <span className="font-semibold text-white">{filteredLeads.length}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selectAllFiltered}
              disabled={loading || filteredLeads.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              <CheckSquare className="size-3.5" aria-hidden />
              Sélectionner tout le filtre actuel
            </button>
            <button
              type="button"
              onClick={selectAll}
              disabled={loading || allLeads.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              <CheckSquare className="size-3.5" aria-hidden />
              Sélectionner tout
            </button>
            <button
              type="button"
              onClick={deselectAll}
              disabled={loading || selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              <Square className="size-3.5" aria-hidden />
              Désélectionner tout
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {error ? (
            <p className="py-8 text-center text-sm text-red-400">{error}</p>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-500">
              <Loader2 className="size-8 animate-spin text-sky-500" aria-hidden />
              <p className="text-sm">Chargement des leads ClickUp…</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">
              {allLeads.length === 0
                ? "Aucun lead avec numéro disponible."
                : "Aucun lead ne correspond à votre recherche ou vos filtres."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/60 text-left text-[10px] uppercase tracking-widest text-zinc-500">
                    <th className="w-12 px-4 py-3 font-medium">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleAllFiltered}
                        aria-label="Sélectionner tout le filtre actuel"
                        className="size-4 rounded border-zinc-600 bg-zinc-900 text-sky-500"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">Nom du client</th>
                    <th className="px-4 py-3 font-medium">Numéro de téléphone</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3 font-medium">Liste</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {filteredLeads.map((lead) => {
                    const checked = selectedIds.has(lead.id);
                    return (
                      <tr
                        key={lead.id}
                        className={cn(
                          "cursor-pointer transition hover:bg-zinc-900/50",
                          checked && "bg-sky-950/15",
                        )}
                        onClick={() => toggleLead(lead.id)}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleLead(lead.id)}
                            aria-label={`Sélectionner ${lead.name || lead.phone}`}
                            className="size-4 rounded border-zinc-600 bg-zinc-900 text-sky-500"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-100">
                          {lead.name || "Sans nom"}
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-400">
                          {formatWhatsAppPhone(lead.phone ?? "")}
                        </td>
                        <td className="px-4 py-3">
                          <LeadStatusBadge status={lead.status} />
                        </td>
                        <td className="max-w-[12rem] truncate px-4 py-3 text-zinc-400">
                          {lead.list_name || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-900/50 px-6 py-4">
          <p className="text-sm text-zinc-400">
            <span className="font-semibold text-white">{selectedPhones.length}</span> numéro
            {selectedPhones.length !== 1 ? "s" : ""} prêt
            {selectedPhones.length !== 1 ? "s" : ""} à importer
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={selectedPhones.length === 0}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Importer {selectedPhones.length} numéro{selectedPhones.length !== 1 ? "s" : ""}{" "}
              sélectionné{selectedPhones.length !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
