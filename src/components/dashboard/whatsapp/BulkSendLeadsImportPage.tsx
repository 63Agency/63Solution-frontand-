"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckSquare,
  ChevronDown,
  Filter,
  Loader2,
  Search,
  Square,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { fetchLeadsForImport } from "@/lib/leads/api-leads";
import { cleanLeadDisplayName } from "@/lib/leads/phone-extract";
import type { ClickUpLead } from "@/lib/leads/types";
import {
  BULK_SEND_PATH,
  stashBulkSendImport,
} from "@/lib/whatsapp/bulk-send-storage";
import { LeadStatusBadge } from "@/src/components/dashboard/leads/LeadStatusBadge";
import { cn } from "@/src/lib/utils";
import { formatWhatsAppPhone } from "./whatsapp-utils";

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
        : `${selected.size} sélectionnés`;

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

export function BulkSendLeadsImportPage() {
  const router = useRouter();
  const [allLeads, setAllLeads] = useState<ClickUpLead[]>([]);
  const [listNames, setListNames] = useState<string[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
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
    void loadLeads();
  }, [loadLeads]);

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
    stashBulkSendImport(selectedPhones);
    toast.success(
      `${selectedPhones.length} numéro${selectedPhones.length > 1 ? "s" : ""} ajouté${selectedPhones.length > 1 ? "s" : ""} à l'envoi multiple.`,
    );
    router.push(BULK_SEND_PATH);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-5 px-6 py-6 md:px-8 md:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link
              href={BULK_SEND_PATH}
              className="mt-1 inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Retour
            </Link>
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-600/15 ring-1 ring-sky-500/25">
                <UserPlus className="size-5 text-sky-400" aria-hidden />
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                  Envoi multiple
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Importer depuis les Leads</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Sélectionnez les contacts ClickUp à ajouter à votre envoi WhatsApp.
                </p>
              </div>
            </div>
          </div>
          <p className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-400">
            <span className="font-semibold text-white">{allLeads.length}</span> leads avec téléphone
          </p>
        </div>

        <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
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
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-600/80 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
            />
          </div>

          <div>
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

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3">
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
              Tout le filtre
            </button>
            <button
              type="button"
              onClick={selectAll}
              disabled={loading || allLeads.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              <CheckSquare className="size-3.5" aria-hidden />
              Tout sélectionner
            </button>
            <button
              type="button"
              onClick={deselectAll}
              disabled={loading || selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              <Square className="size-3.5" aria-hidden />
              Désélectionner
            </button>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/50">
          {error ? (
            <p className="py-16 text-center text-sm text-red-400">{error}</p>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-zinc-500">
              <Loader2 className="size-8 animate-spin text-sky-500" aria-hidden />
              <p className="text-sm">Chargement des leads ClickUp…</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <p className="py-16 text-center text-sm text-zinc-500">
              {allLeads.length === 0
                ? "Aucun lead avec numéro disponible."
                : "Aucun lead ne correspond à votre recherche ou vos filtres."}
            </p>
          ) : (
            <div className="max-h-[min(560px,calc(100vh-22rem))] overflow-y-auto">
              <table className="w-full table-fixed border-collapse text-sm">
                <colgroup>
                  <col style={{ width: 40 }} />
                  <col style={{ width: "30%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "20%" }} />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-zinc-900">
                  <tr className="h-11 border-b border-zinc-800 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                    <th className="px-2 text-center align-middle">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleAllFiltered}
                        aria-label="Sélectionner tout le filtre actuel"
                        className="size-4 rounded border-zinc-600 bg-zinc-950 text-sky-500"
                      />
                    </th>
                    <th className="px-3 align-middle">Nom</th>
                    <th className="px-3 align-middle">Téléphone</th>
                    <th className="px-3 align-middle">Statut</th>
                    <th className="px-3 align-middle">Liste</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredLeads.map((lead, index) => {
                    const checked = selectedIds.has(lead.id);
                    const displayName = cleanLeadDisplayName(lead.name);

                    return (
                      <tr
                        key={lead.id}
                        className={cn(
                          "h-11 cursor-pointer transition-colors duration-150",
                          index % 2 === 0 ? "bg-zinc-950/60" : "bg-zinc-900/40",
                          "hover:bg-sky-950/40",
                          checked && "bg-sky-950/50",
                        )}
                        onClick={() => toggleLead(lead.id)}
                      >
                        <td
                          className="px-2 text-center align-middle"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleLead(lead.id)}
                            aria-label={`Sélectionner ${displayName}`}
                            className="size-4 rounded border-zinc-600 bg-zinc-950 text-sky-500"
                          />
                        </td>
                        <td className="px-3 align-middle">
                          <span
                            className="block truncate text-[13px] font-medium text-zinc-100"
                            title={displayName}
                          >
                            {displayName}
                          </span>
                        </td>
                        <td className="px-3 align-middle">
                          <span className="block truncate font-mono text-[12px] text-zinc-400">
                            {formatWhatsAppPhone(lead.phone ?? "")}
                          </span>
                        </td>
                        <td className="px-3 align-middle">
                          <LeadStatusBadge status={lead.status} />
                        </td>
                        <td className="px-3 align-middle">
                          <span
                            className="block truncate text-[12px] text-zinc-500"
                            title={lead.list_name || undefined}
                          >
                            {lead.list_name || "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
          <p className="text-sm text-zinc-400">
            <span className="font-semibold text-white">{selectedPhones.length}</span> numéro
            {selectedPhones.length !== 1 ? "s" : ""} sélectionné
            {selectedPhones.length !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={BULK_SEND_PATH}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Annuler
            </Link>
            <button
              type="button"
              onClick={handleImport}
              disabled={selectedPhones.length === 0}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Importer {selectedPhones.length} numéro{selectedPhones.length !== 1 ? "s" : ""} vers
              l&apos;envoi multiple
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
