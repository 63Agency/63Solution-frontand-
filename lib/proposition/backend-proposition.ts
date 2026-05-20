import { getApiBaseUrl, getStoredAccessToken } from "../auth/backend-login";
import type {
  BackendClientRecord,
  BackendClientUpdatePayload,
  BackendDevisListItem,
  SendDocumentEmailPayload,
} from "@/lib/devis/backend-devis";
import { registerClientInDirectory } from "@/lib/devis/backend-devis";
import {
  upgradePropositionContentToLatest,
  type PropositionFormState,
  type PropositionTarifLigne,
} from "@/src/components/dashboard/proposition/proposition-types";

const PROPOSITION_NUMERO_COUNTER_KEY = "propositionNumeroSeq";

async function parsePropositionApiError(res: Response, context: string): Promise<never> {
  const raw = await res.text().catch(() => "");
  let message = raw || `Erreur ${res.status}`;
  try {
    const parsed = JSON.parse(raw) as { message?: string | string[] };
    if (typeof parsed.message === "string") message = parsed.message;
    else if (Array.isArray(parsed.message) && parsed.message.length > 0) {
      message = parsed.message.join(", ");
    }
  } catch {
    /* keep raw */
  }
  throw new Error(message);
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
    section2CampagnesPublicitaires: { texte: string };
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
    lignes: Array<{ service: string; prixInitial: string; prixOffert: string }>;
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

export function toBackendPropositionPayload(
  data: PropositionFormState,
  options?: { includeNumero?: boolean },
): BackendPropositionPayload {
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
      section2CampagnesPublicitaires: { texte: data.section2Texte },
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
      lignes: data.tarifsLignes.map((l) => ({
        service: l.service,
        prixInitial: l.prixInitial,
        prixOffert: l.prixOffert,
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
    if (
      upgraded.introParagraphe1 !== parsed.introParagraphe1 ||
      upgraded.introParagraphe2 !== parsed.introParagraphe2
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

/** Crée une proposition sur le serveur (POST /propositions). */
export async function createProposition(
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

  if (!res.ok) return parsePropositionApiError(res, "POST /propositions");

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

/** Met à jour une proposition (PATCH /propositions/:id). */
export async function updateProposition(
  propositionId: string,
  payload: BackendPropositionPayload,
): Promise<BackendPropositionRecord> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const res = await fetch(`${base}/propositions/${encodeURIComponent(propositionId)}`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) return parsePropositionApiError(res, `PATCH /propositions/${propositionId}`);

  const body = (await res.json().catch(() => null)) as
    | { id?: string; numero?: string; propositionNumero?: string; status?: string }
    | null;
  return {
    id: body?.id ?? propositionId,
    numero: body?.numero ?? body?.propositionNumero,
    status: body?.status,
  };
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
  savePropositionLocal({ ...data, propositionNumero: numero }, newId);
}

/**
 * Envoie la proposition au serveur (PATCH si elle existe, sinon POST).
 * Retourne l’id serveur à utiliser pour GET …/pdf.
 */
export async function syncPropositionToServer(
  data: PropositionFormState,
  localId?: string,
): Promise<string> {
  const payload = toBackendPropositionPayload(data, {
    includeNumero: !!data.propositionNumero.trim(),
  });

  if (localId) {
    const base = getApiBaseUrl();
    if (base) {
      const res = await fetch(`${base}/propositions/${encodeURIComponent(localId)}`, {
        method: "PATCH",
        headers: buildAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const body = (await res.json().catch(() => null)) as { id?: string } | null;
        return body?.id ?? localId;
      }
      if (res.status !== 404) {
        return parsePropositionApiError(res, `PATCH /propositions/${localId}`);
      }
    }
  }

  const created = await createProposition(payload);
  if (localId && localId !== created.id) {
    migratePropositionLocalId(localId, created.id, data, {
      id: created.id,
      numero: created.numero,
      titreProposition: data.titreProposition,
      nomEtablissement: data.nomEtablissement,
      preparePour: data.preparePour,
      status: created.status ?? "draft",
      dateEmission: data.dateEmission,
      createdAt: new Date().toISOString(),
    });
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
