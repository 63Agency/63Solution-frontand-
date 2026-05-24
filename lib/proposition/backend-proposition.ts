import { getApiBaseUrl, getStoredAccessToken } from "../auth/backend-login";
import type {
  BackendClientRecord,
  BackendClientUpdatePayload,
  BackendDevisListItem,
  SendDocumentEmailPayload,
} from "@/lib/devis/backend-devis";
import { registerClientInDirectory } from "@/lib/devis/backend-devis";
import {
  resolveTarifLineDetail,
  syncVideoTarifDetailInLignes,
  upgradePropositionContentToLatest,
  type PropositionFormState,
  type PropositionTarifLigne,
} from "@/src/components/dashboard/proposition/proposition-types";

const PROPOSITION_NUMERO_COUNTER_KEY = "propositionNumeroSeq";

async function parsePropositionApiError(
  res: Response,
  context: string,
  payload?: unknown,
): Promise<never> {
  const raw = await res.text().catch(() => "");
  let message = raw || `Erreur ${res.status}`;
  try {
    const parsed = JSON.parse(raw) as { message?: unknown };
    const m = parsed.message;
    if (typeof m === "string" && m.trim() && !/^Erreur HTTP \d+$/i.test(m.trim())) {
      message = m;
    } else if (Array.isArray(m) && m.length > 0) {
      message = m.map((x) => String(x)).join(", ");
    }
  } catch {
    /* keep raw */
  }
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.error(`[Proposition API] ${context}`, res.status, message, payload ?? "");
  }
  throw new Error(message);
}

/** true si la proposition existe déjà en base (uuid serveur). */
async function propositionExistsOnServer(propositionId: string): Promise<boolean> {
  const base = getApiBaseUrl();
  if (!base) return false;
  const token = getStoredAccessToken();
  if (!token) return false;

  const res = await fetch(`${base}/propositions/${encodeURIComponent(propositionId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  return res.ok;
}

/** Payload JSON attendu par le backend Nest pour POST/PATCH /propositions */
export type BackendPropositionPayload = {
  titreProposition: string;
  preparePour: string;
  nomEtablissement: string;
  clientNom?: string;
  preparePar: string;
  dateEmission: string;
  propositionNumero?: string;
  clientIce?: string;
  clientEmail?: string;
  clientTelephone?: string;
  emetteur: {
    societeNom: string;
    societeRc: string;
    societeCnie: string;
    societeIce: string;
    societeTp: string;
    societeAdresse: string;
    societeTelephone: string;
    societeEmail: string;
  };
  introduction: {
    paragraphe1: string;
    paragraphe2: string;
    objectifProspects: number;
  };
  strategie: {
    section1CreationContenu: {
      description: string;
      videosMin: number;
      videosMax: number;
      topics: string[];
    };
    section2CampagnesPublicitaires:
      | { texte: string }
      | {
          intro: string;
          approcheIntro: string;
          blocs: Array<{ titre: string; intro: string; points: string[] }>;
          conclusion: string;
          texte?: string;
        };
    section3FunnelMarketing: {
      intro: string;
      criteres: string[];
      conclusion: string;
    };
    section4Automatisation: {
      points: string[];
      objectif: string;
    };
  };
  tarifs: {
    lignes: Array<{
      service: string;
      detail?: string;
      prixInitial: string;
      prixOffert: string;
    }>;
    noteMetaAds: string;
  };
  pourquoiChoisir: string[];
  prochainesEtapes: string;
  contact: {
    nom: string;
    telephone: string;
    email: string;
    tagline: string;
  };
};

export type BackendPropositionListItem = {
  id: string;
  numero?: string;
  titreProposition?: string;
  nomEtablissement?: string;
  preparePour?: string;
  status?: string;
  dateEmission?: string;
  createdAt?: string;
  /** true après POST/PATCH réussi — ne pas retirer du cache si GET liste vide. */
  serverSynced?: boolean;
};

const LOCAL_STORAGE_KEY = "propositionDrafts";

function buildAuthHeaders(): Record<string, string> {
  const token = getStoredAccessToken();
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export type BackendPropositionRecord = {
  id: string;
  numero?: string;
  status?: string;
};

/** Coordonnées client à enregistrer dans le carnet GET /clients (sans lien avec suppression proposition). */
export function clientPayloadFromPropositionForm(
  data: PropositionFormState,
): BackendClientUpdatePayload {
  return {
    clientNom:
      data.clientNom.trim() ||
      data.nomEtablissement.trim() ||
      data.preparePour.trim(),
    clientEmail: data.clientEmail.trim(),
    clientTelephone: data.clientTelephone.trim(),
    clientIce: data.clientIce.trim(),
  };
}

/** POST /clients si le client n’existe pas encore dans le carnet. */
export async function registerPropositionClientInDirectory(
  data: PropositionFormState,
): Promise<BackendClientRecord | null> {
  return registerClientInDirectory(clientPayloadFromPropositionForm(data));
}

export type PropositionApiPayloadFormat = "legacy" | "full";

function resolveApiPayloadFormat(
  override?: PropositionApiPayloadFormat,
): PropositionApiPayloadFormat {
  if (override) return override;
  return process.env.NEXT_PUBLIC_PROPOSITION_API_FORMAT === "legacy"
    ? "legacy"
    : "full";
}

function buildSection2ForApi(
  data: PropositionFormState,
): BackendPropositionPayload["strategie"]["section2CampagnesPublicitaires"] {
  return {
    intro: data.section2Intro,
    approcheIntro: data.section2Approche,
    blocs: [
      {
        titre: data.section2Bloc1Titre,
        intro: data.section2Bloc1Intro,
        points: data.section2Bloc1Points.filter((t) => t.trim()),
      },
      {
        titre: data.section2Bloc2Titre,
        intro: data.section2Bloc2Intro,
        points: data.section2Bloc2Points.filter((t) => t.trim()),
      },
    ],
    conclusion: data.section2Conclusion,
  };
}

export function toBackendPropositionPayload(
  data: PropositionFormState,
  options?: { includeNumero?: boolean; apiFormat?: PropositionApiPayloadFormat },
): BackendPropositionPayload {
  const apiFormat = resolveApiPayloadFormat(options?.apiFormat);
  const tarifLignes = syncVideoTarifDetailInLignes(
    data.tarifsLignes,
    data.videosMin,
    data.videosMax,
    { force: true },
  );

  return {
    titreProposition: data.titreProposition.trim(),
    preparePour: data.clientNom.trim() || data.preparePour.trim(),
    nomEtablissement: data.nomEtablissement.trim(),
    clientNom: data.clientNom.trim() || data.nomEtablissement.trim() || undefined,
    preparePar: data.preparePar.trim(),
    dateEmission: data.dateEmission,
    ...(options?.includeNumero && data.propositionNumero
      ? { propositionNumero: data.propositionNumero }
      : {}),
    clientIce: data.clientIce.trim() || undefined,
    clientEmail: data.clientEmail.trim() || undefined,
    clientTelephone: data.clientTelephone.trim() || undefined,
    emetteur: {
      societeNom: data.societeNom,
      societeRc: data.societeRc,
      societeCnie: data.societeCnie,
      societeIce: data.societeIce,
      societeTp: data.societeTp,
      societeAdresse: data.societeAdresse,
      societeTelephone: data.societeTelephone,
      societeEmail: data.societeEmail,
    },
    introduction: {
      paragraphe1: data.introParagraphe1,
      paragraphe2: data.introParagraphe2,
      objectifProspects: data.objectifProspects,
    },
    strategie: {
      section1CreationContenu: {
        description: data.section1Description,
        videosMin: data.videosMin,
        videosMax: data.videosMax,
        topics: data.section1Topics.filter((t) => t.trim()),
      },
      section2CampagnesPublicitaires: buildSection2ForApi(data),
      section3FunnelMarketing: {
        intro: data.section3Intro,
        criteres: data.funnelCriteres.filter((t) => t.trim()),
        conclusion: data.section3Conclusion,
      },
      section4Automatisation: {
        points: data.section4Points.filter((t) => t.trim()),
        objectif: data.section4Objectif,
      },
    },
    tarifs: {
      lignes: tarifLignes.map((l) => ({
        service: l.service,
        prixInitial: l.prixInitial,
        prixOffert: l.prixOffert,
        ...(apiFormat === "full"
          ? { detail: resolveTarifLineDetail(l, data.videosMin, data.videosMax) }
          : {}),
      })),
      noteMetaAds: data.tarifsNoteMeta,
    },
    pourquoiChoisir: data.pourquoiChoisir.filter((t) => t.trim()),
    prochainesEtapes: data.prochainesEtapes,
    contact: {
      nom: data.contactNom,
      telephone: data.contactTelephone,
      email: data.contactEmail,
      tagline: data.contactTagline,
    },
  };
}

/** Brouillons locaux tant que GET /propositions n'existe pas. */
export function listPropositionsLocal(): BackendPropositionListItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is BackendPropositionListItem =>
        !!r && typeof r === "object" && typeof (r as { id?: string }).id === "string",
    );
  } catch {
    return [];
  }
}

function collectExistingPropositionNumeros(
  list: BackendPropositionListItem[],
  excludeId?: string,
): string[] {
  const numeros: string[] = [];
  for (const item of list) {
    if (excludeId && item.id === excludeId) continue;
    if (item.numero?.trim()) numeros.push(item.numero.trim());
    else {
      const full = loadPropositionLocal(item.id);
      if (full?.propositionNumero?.trim()) numeros.push(full.propositionNumero.trim());
    }
  }
  return numeros;
}

/** Génère PROP-2026-001, PROP-2026-002, … (unique par année). */
export function generateNextPropositionNumero(excludeId?: string): string {
  const year = new Date().getFullYear();
  const prefix = `PROP-${year}-`;
  const list = listPropositionsLocal();
  const numeros = collectExistingPropositionNumeros(list, excludeId);

  let maxSeq = 0;
  for (const numero of numeros) {
    const match = numero.match(/^PROP-(\d{4})-(\d+)$/i);
    if (!match) continue;
    const numYear = Number.parseInt(match[1], 10);
    const seq = Number.parseInt(match[2], 10);
    if (numYear === year && seq > maxSeq) maxSeq = seq;
  }

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(PROPOSITION_NUMERO_COUNTER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { year?: number; seq?: number };
        if (parsed.year === year && typeof parsed.seq === "number") {
          maxSeq = Math.max(maxSeq, parsed.seq);
        }
      }
    } catch {
      /* ignore */
    }
  }

  const nextSeq = maxSeq + 1;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      PROPOSITION_NUMERO_COUNTER_KEY,
      JSON.stringify({ year, seq: nextSeq }),
    );
  }

  return `${prefix}${String(nextSeq).padStart(3, "0")}`;
}

export function savePropositionLocal(
  data: PropositionFormState,
  id?: string,
  options?: { serverSynced?: boolean },
): BackendPropositionListItem {
  const list = listPropositionsLocal();
  const recordId = id || crypto.randomUUID();
  const propositionNumero =
    data.propositionNumero.trim() || generateNextPropositionNumero(recordId);
  const dataWithNumero: PropositionFormState = { ...data, propositionNumero };

  const existing = list.find((r) => r.id === recordId);
  const item: BackendPropositionListItem = {
    id: recordId,
    numero: propositionNumero,
    titreProposition: dataWithNumero.titreProposition,
    nomEtablissement: dataWithNumero.nomEtablissement,
    preparePour: dataWithNumero.preparePour,
    status: existing?.status ?? "draft",
    dateEmission: dataWithNumero.dateEmission,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    serverSynced: options?.serverSynced ?? existing?.serverSynced,
  };
  const payload = { ...dataWithNumero, _savedAt: new Date().toISOString() };
  const next = list.filter((r) => r.id !== recordId);
  next.unshift(item);
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
  window.localStorage.setItem(
    `${LOCAL_STORAGE_KEY}:${recordId}`,
    JSON.stringify(payload),
  );
  return item;
}

export function loadPropositionLocal(id: string): PropositionFormState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${LOCAL_STORAGE_KEY}:${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PropositionFormState & { _savedAt?: string };
    const upgraded = upgradePropositionContentToLatest(parsed);
    const tarifsChanged =
      JSON.stringify(upgraded.tarifsLignes) !== JSON.stringify(parsed.tarifsLignes);
    const section2Changed =
      upgraded.section2Intro !== (parsed as { section2Intro?: string }).section2Intro ||
      Boolean((parsed as { section2Texte?: string }).section2Texte);
    if (
      upgraded.introParagraphe1 !== parsed.introParagraphe1 ||
      upgraded.introParagraphe2 !== parsed.introParagraphe2 ||
      tarifsChanged ||
      section2Changed
    ) {
      savePropositionLocal(upgraded, id);
    }
    return upgraded;
  } catch {
    return null;
  }
}

export const PROPOSITION_CLIENT_ID_PREFIX = "prop-";

export function isPropositionLocalClientId(id: string): boolean {
  return id.startsWith(PROPOSITION_CLIENT_ID_PREFIX);
}

export function propositionIdFromClientId(clientId: string): string | null {
  if (!isPropositionLocalClientId(clientId)) return null;
  return clientId.slice(PROPOSITION_CLIENT_ID_PREFIX.length);
}

export type PropositionClientUpdate = {
  clientNom: string;
  clientEmail: string;
  clientTelephone: string;
  clientIce: string;
};

/** Clients issus des propositions (id stable prop-xxx pour édition locale). */
export function listPropositionClientRecords(): BackendClientRecord[] {
  return listPropositionClientDocRows().map((r) => ({
    id: r.id!,
    clientNom: r.clientNom,
    clientEmail: r.clientEmail,
    clientTelephone: r.clientTelephone,
    clientIce: r.clientIce,
  }));
}

export function updatePropositionLocalClient(
  clientId: string,
  payload: PropositionClientUpdate,
): BackendClientRecord {
  const propId = propositionIdFromClientId(clientId);
  if (!propId) throw new Error("Client proposition invalide.");
  const data = loadPropositionLocal(propId);
  if (!data) throw new Error("Proposition introuvable.");

  const clientNom = payload.clientNom.trim();
  const next: PropositionFormState = {
    ...data,
    clientNom,
    preparePour: clientNom,
    clientEmail: payload.clientEmail.trim(),
    clientTelephone: payload.clientTelephone.trim(),
    clientIce: payload.clientIce.trim(),
  };
  savePropositionLocal(next, propId);

  return {
    id: clientId,
    clientNom,
    clientEmail: next.clientEmail || undefined,
    clientTelephone: next.clientTelephone || undefined,
    clientIce: next.clientIce || undefined,
  };
}

/** Retire le client de la liste (efface les coordonnées sur la proposition liée). */
export function clearPropositionLocalClient(clientId: string): void {
  const propId = propositionIdFromClientId(clientId);
  if (!propId) throw new Error("Client proposition invalide.");
  const data = loadPropositionLocal(propId);
  if (!data) throw new Error("Proposition introuvable.");

  savePropositionLocal(
    {
      ...data,
      clientNom: "",
      preparePour: "",
      clientEmail: "",
      clientTelephone: "",
      clientIce: "",
    },
    propId,
  );
}

/** Lignes « document » pour fusionner les clients propositions dans la page Clients. */
export function listPropositionClientDocRows(): BackendDevisListItem[] {
  const rows: BackendDevisListItem[] = [];
  for (const item of listPropositionsLocal()) {
    const full = loadPropositionLocal(item.id);
    const clientNom =
      full?.clientNom?.trim() ||
      full?.nomEtablissement?.trim() ||
      item.nomEtablissement?.trim() ||
      full?.preparePour?.trim() ||
      item.preparePour?.trim() ||
      "";
    const clientEmail = full?.clientEmail?.trim();
    const clientTelephone = full?.clientTelephone?.trim();
    const clientIce = full?.clientIce?.trim();
    if (!clientNom && !clientEmail && !clientIce) continue;
    rows.push({
      id: `prop-${item.id}`,
      clientNom: clientNom || undefined,
      clientEmail: clientEmail || undefined,
      clientTelephone: clientTelephone || undefined,
      clientIce: clientIce || undefined,
    });
  }
  return rows;
}

async function postProposition(
  payload: BackendPropositionPayload,
): Promise<BackendPropositionRecord> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const res = await fetch(`${base}/propositions`, {
    method: "POST",
    headers: buildAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) return parsePropositionApiError(res, "POST /propositions", payload);

  const body = (await res.json().catch(() => null)) as
    | { id?: string; numero?: string; propositionNumero?: string; status?: string }
    | null;
  if (!body?.id) throw new Error("Réponse backend invalide après création proposition.");
  return {
    id: body.id,
    numero: body.numero ?? body.propositionNumero,
    status: body.status,
  };
}

/** Crée une proposition sur le serveur (POST /propositions). */
export async function createProposition(
  data: PropositionFormState,
  options?: { includeNumero?: boolean; apiFormat?: PropositionApiPayloadFormat },
): Promise<BackendPropositionRecord> {
  const payload = toBackendPropositionPayload(data, options);
  return postProposition(payload);
}

/** @deprecated Préférer createProposition(data) — conservé pour appels internes. */
export async function createPropositionWithPayload(
  payload: BackendPropositionPayload,
): Promise<BackendPropositionRecord> {
  return postProposition(payload);
}

/** Met à jour une proposition (PATCH /propositions/:id). */
export async function updateProposition(
  propositionId: string,
  data: PropositionFormState,
  options?: { includeNumero?: boolean; apiFormat?: PropositionApiPayloadFormat },
): Promise<BackendPropositionRecord> {
  const payload = toBackendPropositionPayload(data, options);
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const res = await fetch(`${base}/propositions/${encodeURIComponent(propositionId)}`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return parsePropositionApiError(res, `PATCH /propositions/${propositionId}`, payload);
  }

  const body = (await res.json().catch(() => null)) as
    | { id?: string; numero?: string; propositionNumero?: string; status?: string }
    | null;
  return {
    id: body?.id ?? propositionId,
    numero: body?.numero ?? body?.propositionNumero,
    status: body?.status,
  };
}

function parsePropositionListItem(row: unknown): BackendPropositionListItem | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = String(r.id ?? "");
  if (!id) return null;
  return {
    id,
    numero:
      typeof r.numero === "string"
        ? r.numero
        : typeof r.propositionNumero === "string"
          ? r.propositionNumero
          : undefined,
    titreProposition:
      typeof r.titreProposition === "string" ? r.titreProposition : undefined,
    nomEtablissement:
      typeof r.nomEtablissement === "string" ? r.nomEtablissement : undefined,
    preparePour: typeof r.preparePour === "string" ? r.preparePour : undefined,
    status: typeof r.status === "string" ? r.status : undefined,
    dateEmission:
      typeof r.dateEmission === "string" ? r.dateEmission : undefined,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : undefined,
  };
}

export type PropositionFetchSource =
  | "api"
  | "local"
  | "auth"
  | "unreachable"
  | "config";

export type FetchPropositionsResult = {
  items: BackendPropositionListItem[];
  source: PropositionFetchSource;
};

/** Liste des propositions sur le serveur (GET /propositions). */
export async function fetchPropositionsFromApi(): Promise<FetchPropositionsResult> {
  const base = getApiBaseUrl();
  if (!base) return { items: [], source: "config" };

  const token = getStoredAccessToken();
  if (!token) return { items: [], source: "auth" };

  let res: Response;
  try {
    res = await fetch(`${base}/propositions`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
  } catch {
    return { items: [], source: "unreachable" };
  }

  if (res.status === 401 || res.status === 403) {
    return { items: [], source: "auth" };
  }
  if (res.status === 404) {
    return { items: [], source: "local" };
  }
  if (!res.ok) {
    return { items: [], source: "unreachable" };
  }

  const raw = (await res.json().catch(() => null)) as unknown;
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown[] }).items)
      ? ((raw as { items: unknown[] }).items as unknown[])
      : [];

  const items = list
    .map((row) => parsePropositionListItem(row))
    .filter((v): v is BackendPropositionListItem => v !== null);

  return { items, source: "api" };
}

/**
 * Aligne le cache local sur GET /propositions : retire les brouillons jamais enregistrés en base.
 */
export function reconcileLocalPropositionsWithServer(
  serverItems: BackendPropositionListItem[],
): BackendPropositionListItem[] {
  const serverIds = new Set(serverItems.map((i) => i.id));
  const localList = listPropositionsLocal();

  if (serverItems.length > 0) {
    for (const item of localList) {
      if (!serverIds.has(item.id) && !item.serverSynced) {
        deletePropositionLocal(item.id);
      }
    }
  }

  const mergedFromServer = serverItems.map((server) => {
    const prev = localList.find((l) => l.id === server.id);
    return { ...prev, ...server, serverSynced: true };
  });

  const serverMergedIds = new Set(mergedFromServer.map((i) => i.id));
  const localOnlySynced = localList.filter(
    (item) => item.serverSynced && !serverMergedIds.has(item.id),
  );

  const merged = [...mergedFromServer, ...localOnlySynced];

  if (typeof window !== "undefined") {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
  }

  return merged;
}

export type LoadPropositionsForDashboardResult = {
  items: BackendPropositionListItem[];
  source: PropositionFetchSource;
};

export function propositionListSourceLabel(source: PropositionFetchSource): string {
  switch (source) {
    case "api":
      return "Synchronisé avec GET /propositions";
    case "auth":
      return "Brouillons locaux — reconnecte-toi pour synchroniser avec l’API";
    case "unreachable":
      return "Brouillons locaux — API Nest injoignable (http://localhost:3002)";
    case "config":
      return "Brouillons locaux — NEXT_PUBLIC_API_URL manquante dans .env.local";
    default:
      return "Brouillons locaux (GET /propositions non disponible)";
  }
}

/** Charge la liste : API d’abord, sinon brouillons localStorage. */
export async function loadPropositionsForDashboard(): Promise<LoadPropositionsForDashboardResult> {
  const { items, source } = await fetchPropositionsFromApi();
  if (source === "api") {
    return {
      items: reconcileLocalPropositionsWithServer(items),
      source: "api",
    };
  }
  return { items: listPropositionsLocal(), source };
}

const PROP_NUMERO_RE = /^PROP-\d{4}-\d+$/i;

function normalizePropositionNumeroRef(value?: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  const asProp = trimmed.replace(/^PR-/i, "PROP-");
  return PROP_NUMERO_RE.test(asProp) ? asProp : "";
}

/**
 * Référence à envoyer à DELETE /propositions/:ref (uuid serveur ou numero PROP-YYYY-NNN).
 * Préfère le numéro officiel pour éviter un uuid localStorage obsolète après POST.
 */
export function resolvePropositionDeleteRef(
  id: string,
  numero?: string,
): string {
  const trimmedId = id.trim();
  const fromList = listPropositionsLocal().find((r) => r.id === trimmedId);
  const fromForm = loadPropositionLocal(trimmedId);
  const officialNumero = normalizePropositionNumeroRef(
    numero ?? fromList?.numero ?? fromForm?.propositionNumero,
  );
  if (officialNumero) return officialNumero;
  return trimmedId;
}

function isPropositionAlreadyGoneMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("introuvable") ||
    m.includes("déjà supprimée") ||
    m.includes("deja supprimee") ||
    m.includes("jamais enregistrée") ||
    m.includes("jamais enregistree")
  );
}

/**
 * Supprime la proposition en base (Nest → Supabase).
 * ref = uuid renvoyé par POST /propositions, ou numero PROP-2026-012.
 * 200 = succès (y compris « déjà supprimée / introuvable »).
 */
export async function deleteProposition(ref: string): Promise<void> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const encodedRef = encodeURIComponent(ref.trim());
  const headers = buildAuthHeaders();
  const deleteUrl = `${base}/propositions/${encodedRef}`;
  const postDeleteUrl = `${base}/propositions/${encodedRef}/delete`;

  let res = await fetch(deleteUrl, {
    method: "DELETE",
    headers,
    credentials: "include",
  });

  if (res.status === 404 || res.status === 405) {
    res = await fetch(postDeleteUrl, {
      method: "POST",
      headers,
      credentials: "include",
    });
  }

  const body = (await res.json().catch(() => ({}))) as { message?: unknown };

  if (res.ok) return;

  const message =
    typeof body.message === "string"
      ? body.message
      : `Suppression impossible (${res.status})`;

  if (isPropositionAlreadyGoneMessage(message)) return;

  throw new Error(message);
}

/** Retire du cache local toutes les entrées liées à cet id ou numéro PROP. */
export function deletePropositionLocalByRef(id: string, numero?: string): void {
  const trimmedId = id.trim();
  const officialNumero = normalizePropositionNumeroRef(
    numero ??
      listPropositionsLocal().find((r) => r.id === trimmedId)?.numero ??
      loadPropositionLocal(trimmedId)?.propositionNumero,
  );

  const idsToRemove = new Set<string>();
  if (trimmedId) idsToRemove.add(trimmedId);

  for (const item of listPropositionsLocal()) {
    if (item.id === trimmedId) idsToRemove.add(item.id);
    if (officialNumero && normalizePropositionNumeroRef(item.numero) === officialNumero) {
      idsToRemove.add(item.id);
    }
    const full = loadPropositionLocal(item.id);
    if (officialNumero && normalizePropositionNumeroRef(full?.propositionNumero) === officialNumero) {
      idsToRemove.add(item.id);
    }
  }

  for (const removeId of idsToRemove) {
    deletePropositionLocal(removeId);
  }
}

/**
 * Supprime en base puis nettoie localStorage — à brancher sur le bouton 🗑️.
 * Ne retire la ligne UI qu’après succès de cette fonction.
 */
export async function deletePropositionAndLocal(
  id: string,
  options?: { numero?: string },
): Promise<void> {
  const ref = resolvePropositionDeleteRef(id, options?.numero);
  await deleteProposition(ref);
  deletePropositionLocalByRef(id, options?.numero);
}

function migratePropositionLocalId(
  oldId: string,
  newId: string,
  data: PropositionFormState,
  meta: BackendPropositionListItem,
): void {
  if (typeof window === "undefined" || oldId === newId) return;
  deletePropositionLocal(oldId);
  const numero = meta.numero ?? data.propositionNumero;
  savePropositionLocal({ ...data, propositionNumero: numero }, newId, {
    serverSynced: true,
  });
}

/**
 * Envoie la proposition au serveur (PATCH si elle existe, sinon POST).
 * Retourne l’id serveur à utiliser pour GET …/pdf.
 */
export async function syncPropositionToServer(
  data: PropositionFormState,
  localId?: string,
): Promise<string> {
  const existsOnServer =
    localId !== undefined && (await propositionExistsOnServer(localId));

  if (existsOnServer && localId) {
    const updated = await updateProposition(localId, data, {
      includeNumero: !!data.propositionNumero.trim(),
    });
    const dataWithNumero = {
      ...data,
      propositionNumero: updated.numero ?? data.propositionNumero,
    };
    savePropositionLocal(dataWithNumero, updated.id, { serverSynced: true });
    return updated.id;
  }

  const created = await createProposition(data, { includeNumero: false });
  const dataWithNumero = {
    ...data,
    propositionNumero: created.numero ?? data.propositionNumero,
  };
  const meta: BackendPropositionListItem = {
    id: created.id,
    numero: created.numero,
    titreProposition: data.titreProposition,
    nomEtablissement: data.nomEtablissement,
    preparePour: data.preparePour,
    status: created.status ?? "draft",
    dateEmission: data.dateEmission,
    createdAt: new Date().toISOString(),
    serverSynced: true,
  };

  if (localId && localId !== created.id) {
    migratePropositionLocalId(localId, created.id, dataWithNumero, meta);
  } else {
    savePropositionLocal(dataWithNumero, created.id, { serverSynced: true });
  }

  return created.id;
}

/** Télécharge le PDF depuis l’API (même comportement que devis / factures). */
export async function downloadPropositionPdf(
  propositionId: string,
  fallbackName?: string,
): Promise<void> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const token = getStoredAccessToken();
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");

  let serverId = propositionId;
  let local = loadPropositionLocal(propositionId);
  if (local) {
    local = upgradePropositionContentToLatest(local);
    savePropositionLocal(local, propositionId);
    serverId = await syncPropositionToServer(local, propositionId);
  }

  const res = await fetch(`${base}/propositions/${encodeURIComponent(serverId)}/pdf`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });

  if (res.status === 404) {
    throw new Error(
      "PDF introuvable sur le serveur. Le dev backend doit implémenter GET /propositions/:id/pdf (voir docs/BACKEND-PROPOSITIONS.md).",
    );
  }

  if (!res.ok) {
    return parsePropositionApiError(res, `GET /propositions/${serverId}/pdf`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const safeName = (fallbackName || "proposition").replace(/[^a-zA-Z0-9_-]/g, "-");
  anchor.download = `${safeName}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export async function sendPropositionEmail(
  propositionId: string,
  payload: SendDocumentEmailPayload,
): Promise<void> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const token = getStoredAccessToken();
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");

  const candidates = [
    { url: `${base}/propositions/${encodeURIComponent(propositionId)}/send-email`, method: "POST" as const },
    { url: `${base}/propositions/${encodeURIComponent(propositionId)}/email`, method: "POST" as const },
    { url: `${base}/propositions/${encodeURIComponent(propositionId)}/send`, method: "POST" as const },
  ];

  let lastError: Error | null = null;

  for (const candidate of candidates) {
    const res = await fetch(candidate.url, {
      method: candidate.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (res.status === 404) continue;
    if (!res.ok) {
      try {
        return parsePropositionApiError(res, `${candidate.method} ${candidate.url}`);
      } catch (e) {
        lastError = e instanceof Error ? e : new Error("Envoi email proposition impossible.");
        break;
      }
    }
    return;
  }

  if (lastError) throw lastError;
  throw new Error(
    "Envoi email proposition : endpoint introuvable (POST /propositions/:id/send-email).",
  );
}

export function deletePropositionLocal(id: string): void {
  if (typeof window === "undefined") return;
  const list = listPropositionsLocal().filter((r) => r.id !== id);
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  window.localStorage.removeItem(`${LOCAL_STORAGE_KEY}:${id}`);
}
