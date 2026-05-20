"use client";

import { useEffect, useState } from "react";
import {
  DashboardView,
  TimeToggle,
  type DashboardBusinessKpis,
} from "../ui/IndustryStandard";
import {
  fetchClientsListDetailed,
  fetchDevisList,
  fetchFacturesList,
  type BackendDevisListItem,
} from "../../../lib/devis/backend-devis";

function sumTotalTtc(rows: BackendDevisListItem[]): number {
  return rows.reduce((s, r) => s + (Number(r.totals?.totalTtc) || 0), 0);
}

const HIDDEN_CONVERTED_DEVIS_KEY = "hiddenConvertedDevisIds";

function readHiddenConvertedDevisIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(HIDDEN_CONVERTED_DEVIS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

/** Même règle que la page Factures : devis transférés en facture masqués côté client. */
function filterDevisForDashboard(
  devis: BackendDevisListItem[],
  hiddenIds: Set<string>,
): BackendDevisListItem[] {
  return devis.filter((d) => !hiddenIds.has(d.id));
}

const initialKpis: DashboardBusinessKpis = {
  loading: true,
  pendingDevisMad: 0,
  validatedFacturesMad: 0,
  clientCount: 0,
  clientsSource: "unavailable",
  error: null,
};

export function IndustryHomeContent() {
  const [timeRange, setTimeRange] = useState("Daily");
  const [businessKpis, setBusinessKpis] = useState<DashboardBusinessKpis>(initialKpis);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [devis, factures, clientsResult] = await Promise.all([
          fetchDevisList(),
          fetchFacturesList(),
          fetchClientsListDetailed(),
        ]);
        if (cancelled) return;

        const hiddenConverted = readHiddenConvertedDevisIds();
        const devisForTotals = filterDevisForDashboard(devis, hiddenConverted);

        const clientCount = clientsResult.authoritativeFromApi
          ? clientsResult.clients.length
          : 0;
        const clientsSource = clientsResult.authoritativeFromApi ? "api" : "unavailable";

        setBusinessKpis({
          loading: false,
          error: null,
          pendingDevisMad: sumTotalTtc(devisForTotals),
          validatedFacturesMad: sumTotalTtc(factures),
          clientCount,
          clientsSource,
        });
      } catch (e) {
        if (!cancelled) {
          setBusinessKpis((prev) => ({
            ...prev,
            loading: false,
            error:
              e instanceof Error
                ? e.message
                : "Impossible de charger les indicateurs du tableau de bord.",
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-zinc-500">Tableau de bord</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            63 Agency — Solution
          </h1>
        </div>
        <TimeToggle active={timeRange} onChange={setTimeRange} />
      </div>
      <DashboardView timeRange={timeRange} businessKpis={businessKpis} />
    </div>
  );
}
