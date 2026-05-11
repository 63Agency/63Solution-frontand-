import { getApiBaseUrl, getStoredAccessToken } from "../auth/backend-login";
import type { DevisFormState } from "../../src/components/dashboard/devis/devis-types";

export type BackendDevisPayload = {
  societeNom: string;
  societeRc: string;
  societeCnie: string;
  societeIce: string;
  societeTp: string;
  societeAdresse: string;
  societeTelephone: string;
  societeEmail: string;
  clientNom: string;
  clientIce: string;
  clientEmail: string;
  clientTelephone: string;
  devisNumero?: string;
  factureNumero?: string;
  dateEmission: string;
  lignes: Array<{
    id: string;
    titre: string;
    description: string;
    quantite: number;
    prixUnitaireHt: number;
  }>;
  tvaTaux: number;
  mentionTva: string;
  paiementMode: string;
  paiementBanque: string;
  paiementTitulaire: string;
  paiementRib: string;
};

export type BackendDevisRecord = {
  id: string;
  numero?: string;
  status?: string;
  clientNom?: string;
  dateEmission?: string;
  createdAt?: string;
  totals?: {
    totalHt?: number;
    montantTva?: number;
    totalTtc?: number;
  };
  societeNom?: string;
  societeRc?: string;
  societeCnie?: string;
  societeIce?: string;
  societeTp?: string;
  societeAdresse?: string;
  societeTelephone?: string;
  societeEmail?: string;
  clientIce?: string;
  clientEmail?: string;
  clientTelephone?: string;
  mentionTva?: string;
  paiementMode?: string;
  paiementBanque?: string;
  paiementTitulaire?: string;
  paiementRib?: string;
  /** Taux TVA en % (ex. 20), si renvoyé par l’API. */
  tvaTaux?: number;
  lignes?: Array<{
    id?: string;
    titre?: string;
    description?: string;
    quantite?: number;
    prixUnitaireHt?: number;
  }>;
};

export type BackendDevisListItem = BackendDevisRecord;

/** Client renvoyé par GET /clients (ou variante). */
export type BackendClientRecord = {
  id: string;
  clientNom?: string;
  clientEmail?: string;
  clientTelephone?: string;
  clientIce?: string;
};

export type BackendClientUpdatePayload = {
  clientNom: string;
  clientEmail: string;
  clientTelephone: string;
  clientIce: string;
};

export type SendDocumentEmailPayload = {
  to: string;
  subject?: string;
  message: string;
};

function resolveNumero(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as {
    numero?: string;
    factureNumero?: string;
    numeroFacture?: string;
    devisNumero?: string;
  };
  return v.numero ?? v.factureNumero ?? v.numeroFacture ?? v.devisNumero;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseBackendDevisRecord(row: unknown): BackendDevisRecord | null {
  const r = row as {
    id?: string;
    numero?: string;
    factureNumero?: string;
    numeroFacture?: string;
    devisNumero?: string;
    status?: string;
    clientNom?: string;
    dateEmission?: string;
    createdAt?: string;
    societeNom?: string;
    societeRc?: string;
    societeCnie?: string;
    societeIce?: string;
    societeTp?: string;
    societeAdresse?: string;
    societeTelephone?: string;
    societeEmail?: string;
    clientIce?: string;
    clientEmail?: string;
    clientTelephone?: string;
    mentionTva?: string;
    paiementMode?: string;
    paiementBanque?: string;
    paiementTitulaire?: string;
    paiementRib?: string;
    lignes?: Array<{
      id?: string;
      titre?: string;
      description?: string;
      quantite?: number;
      prixUnitaireHt?: number;
    }>;
    totals?: {
      totalHt?: number | string;
      montantTva?: number | string;
      totalTtc?: number | string;
      totalTTC?: number | string;
    };
    tvaTaux?: number | string;
  };
  if (!r?.id) return null;
  const totalHt = asNumber(r.totals?.totalHt);
  const montantTva = asNumber(r.totals?.montantTva);
  const totalTtc = asNumber(r.totals?.totalTtc) ?? asNumber(r.totals?.totalTTC);
  const tvaTauxParsed = asNumber(r.tvaTaux);

  return {
    id: r.id,
    numero: resolveNumero(r),
    status: r.status,
    clientNom: r.clientNom,
    dateEmission: r.dateEmission,
    createdAt: r.createdAt,
    societeNom: r.societeNom,
    societeRc: r.societeRc,
    societeCnie: r.societeCnie,
    societeIce: r.societeIce,
    societeTp: r.societeTp,
    societeAdresse: r.societeAdresse,
    societeTelephone: r.societeTelephone,
    societeEmail: r.societeEmail,
    clientIce: r.clientIce,
    clientEmail: r.clientEmail,
    clientTelephone: r.clientTelephone,
    mentionTva: r.mentionTva,
    paiementMode: r.paiementMode,
    paiementBanque: r.paiementBanque,
    paiementTitulaire: r.paiementTitulaire,
    paiementRib: r.paiementRib,
    tvaTaux: tvaTauxParsed != null && tvaTauxParsed >= 0 ? tvaTauxParsed : undefined,
    lignes: Array.isArray(r.lignes) ? r.lignes : undefined,
    totals:
      totalTtc !== null || totalHt !== null || montantTva !== null
        ? {
            totalHt: totalHt ?? undefined,
            montantTva: montantTva ?? undefined,
            totalTtc: totalTtc ?? undefined,
          }
        : undefined,
  };
}

function buildAuthHeaders() {
  const token = getStoredAccessToken();
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export function toBackendDevisPayload(
  data: DevisFormState,
  options?: { includeNumero?: boolean },
): BackendDevisPayload {
  const includeNumero = options?.includeNumero ?? true;
  const payload: BackendDevisPayload = {
    societeNom: data.societeNom.trim(),
    societeRc: data.societeRc.trim(),
    societeCnie: data.societeCnie.trim(),
    societeIce: data.societeIce.trim(),
    societeTp: data.societeTp.trim(),
    societeAdresse: data.societeAdresse.trim(),
    societeTelephone: data.societeTelephone.trim(),
    societeEmail: data.societeEmail.trim(),
    clientNom: data.clientNom.trim(),
    clientIce: data.clientIce.trim(),
    clientEmail: data.clientEmail.trim(),
    clientTelephone: data.clientTelephone.trim(),
    dateEmission: data.dateEmission,
    lignes: data.lignes.map((l) => ({
      id: l.id,
      titre: l.titre.trim(),
      description: l.description.trim(),
      quantite: l.quantite,
      prixUnitaireHt: l.prixUnitaireHt,
    })),
    tvaTaux: data.tvaTaux,
    mentionTva: data.mentionTva.trim(),
    paiementMode: data.paiementMode.trim(),
    paiementBanque: data.paiementBanque.trim(),
    paiementTitulaire: data.paiementTitulaire.trim(),
    paiementRib: data.paiementRib.trim(),
  };

  const numero = data.devisNumero.trim();
  if (includeNumero) {
    // بعض DTOs في الباكند قد تبقي devisNumero مطلوبًا حتى لو يتم تجاهله منطقيًا.
    // نرسل قيمة fallback لتفادي 400 Validation.
    payload.devisNumero = "AUTO";
    // Si présent, on transmet la valeur saisie (sinon fallback AUTO).
    if (numero.length > 0) {
      payload.devisNumero = numero;
    }
  } else {
    // Contrat facture: envoyer factureNumero (jamais devisNumero).
    payload.factureNumero = numero;
  }

  return payload;
}

async function parseApiError(
  res: Response,
  context: string,
  payload?: unknown,
): Promise<never> {
  const raw = await res.text().catch(() => "");
  let parsed: { message?: string | string[] } | null = null;
  try {
    parsed = raw ? (JSON.parse(raw) as { message?: string | string[] }) : null;
  } catch {
    parsed = null;
  }

  const message =
    typeof parsed?.message === "string"
      ? parsed.message
      : Array.isArray(parsed?.message) && parsed.message.length > 0
        ? parsed.message.join(", ")
        : raw || `Erreur ${res.status}`;

  // Debug logs (dev only) to inspect 400 details quickly
  // eslint-disable-next-line no-console
  console.group(`[Devis API Error] ${context}`);
  // eslint-disable-next-line no-console
  console.error("status:", res.status, res.statusText);
  // eslint-disable-next-line no-console
  console.error("url:", res.url);
  // eslint-disable-next-line no-console
  console.error("response raw:", raw);
  if (payload !== undefined) {
    // eslint-disable-next-line no-console
    console.error("request payload:", payload);
  }
  // eslint-disable-next-line no-console
  console.groupEnd();

  throw new Error(message);
}

export async function createDevis(payload: BackendDevisPayload): Promise<BackendDevisRecord> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const res = await fetch(`${base}/devis`, {
    method: "POST",
    headers: buildAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) return parseApiError(res, "POST /devis", payload);

  const body = (await res.json().catch(() => null)) as
    | {
        id?: string;
        numero?: string;
        factureNumero?: string;
        numeroFacture?: string;
        devisNumero?: string;
        status?: string;
        totals?: {
          totalHt?: number | string;
          montantTva?: number | string;
          totalTtc?: number | string;
          totalTTC?: number | string;
        };
      }
    | null;
  if (!body?.id) throw new Error("Réponse backend invalide après création devis.");
  const totalHt = asNumber(body?.totals?.totalHt);
  const montantTva = asNumber(body?.totals?.montantTva);
  const totalTtc =
    asNumber(body?.totals?.totalTtc) ?? asNumber(body?.totals?.totalTTC);

  return {
    id: body.id,
    numero: resolveNumero(body),
    status: body.status,
    totals:
      totalHt !== null && montantTva !== null && totalTtc !== null
        ? { totalHt, montantTva, totalTtc }
        : undefined,
  };
}

export async function createFacture(
  payload: BackendDevisPayload,
): Promise<BackendDevisRecord> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const res = await fetch(`${base}/factures`, {
    method: "POST",
    headers: buildAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) return parseApiError(res, "POST /factures", payload);

  const body = (await res.json().catch(() => null)) as
    | {
        id?: string;
        numero?: string;
        factureNumero?: string;
        numeroFacture?: string;
        devisNumero?: string;
        status?: string;
        totals?: {
          totalHt?: number | string;
          montantTva?: number | string;
          totalTtc?: number | string;
          totalTTC?: number | string;
        };
      }
    | null;
  if (!body?.id) throw new Error("Réponse backend invalide après création facture.");
  const totalHt = asNumber(body?.totals?.totalHt);
  const montantTva = asNumber(body?.totals?.montantTva);
  const totalTtc =
    asNumber(body?.totals?.totalTtc) ?? asNumber(body?.totals?.totalTTC);

  return {
    id: body.id,
    numero: resolveNumero(body),
    status: body.status,
    totals:
      totalHt !== null && montantTva !== null && totalTtc !== null
        ? { totalHt, montantTva, totalTtc }
        : undefined,
  };
}

export async function updateDevis(
  devisId: string,
  payload: BackendDevisPayload,
): Promise<BackendDevisRecord> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const res = await fetch(`${base}/devis/${encodeURIComponent(devisId)}`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) return parseApiError(res, `PATCH /devis/${devisId}`, payload);

  const body = (await res.json().catch(() => null)) as
    | {
        id?: string;
        numero?: string;
        factureNumero?: string;
        numeroFacture?: string;
        devisNumero?: string;
        status?: string;
        totals?: {
          totalHt?: number | string;
          montantTva?: number | string;
          totalTtc?: number | string;
          totalTTC?: number | string;
        };
      }
    | null;
  if (!body?.id) throw new Error("Réponse backend invalide après mise à jour devis.");

  const totalHt = asNumber(body?.totals?.totalHt);
  const montantTva = asNumber(body?.totals?.montantTva);
  const totalTtc =
    asNumber(body?.totals?.totalTtc) ?? asNumber(body?.totals?.totalTTC);

  return {
    id: body.id,
    numero: resolveNumero(body),
    status: body.status,
    totals:
      totalHt !== null && montantTva !== null && totalTtc !== null
        ? { totalHt, montantTva, totalTtc }
        : undefined,
  };
}

export async function updateFacture(
  factureId: string,
  payload: BackendDevisPayload,
): Promise<BackendDevisRecord> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const res = await fetch(`${base}/factures/${encodeURIComponent(factureId)}`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) return parseApiError(res, `PATCH /factures/${factureId}`, payload);

  const body = (await res.json().catch(() => null)) as
    | {
        id?: string;
        numero?: string;
        factureNumero?: string;
        numeroFacture?: string;
        devisNumero?: string;
        status?: string;
        totals?: {
          totalHt?: number | string;
          montantTva?: number | string;
          totalTtc?: number | string;
          totalTTC?: number | string;
        };
      }
    | null;
  if (!body?.id) throw new Error("Réponse backend invalide après mise à jour facture.");

  const totalHt = asNumber(body?.totals?.totalHt);
  const montantTva = asNumber(body?.totals?.montantTva);
  const totalTtc =
    asNumber(body?.totals?.totalTtc) ?? asNumber(body?.totals?.totalTTC);

  return {
    id: body.id,
    numero: resolveNumero(body),
    status: body.status,
    totals:
      totalHt !== null && montantTva !== null && totalTtc !== null
        ? { totalHt, montantTva, totalTtc }
        : undefined,
  };
}

export async function fetchDevisList(): Promise<BackendDevisListItem[]> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const token = getStoredAccessToken();
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");

  const candidates = ["/devis", "/devis/list", "/devis/mine"];
  let lastError: Error | null = null;

  for (const path of candidates) {
    const res = await fetch(`${base}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });

    if (res.status === 404) continue;
    if (!res.ok) {
      try {
        return await parseApiError(res, `GET ${path}`);
      } catch (e) {
        lastError = e instanceof Error ? e : new Error("Erreur liste devis.");
        break;
      }
    }

    const raw = (await res.json().catch(() => null)) as unknown;
    const list = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown[] }).items)
        ? ((raw as { items: unknown[] }).items as unknown[])
        : [];

    return list
      .map((row) => parseBackendDevisRecord(row))
      .filter((v): v is BackendDevisListItem => v !== null);
  }

  if (lastError) throw lastError;
  throw new Error("Aucun endpoint de liste devis disponible (GET /devis ou variantes).");
}

export async function fetchFacturesList(): Promise<BackendDevisListItem[]> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const token = getStoredAccessToken();
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");

  const res = await fetch(`${base}/factures`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });

  if (!res.ok) return parseApiError(res, "GET /factures");

  const raw = (await res.json().catch(() => null)) as unknown;
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown[] }).items)
      ? ((raw as { items: unknown[] }).items as unknown[])
      : [];

  return list
    .map((row) => parseBackendDevisRecord(row))
    .filter((v): v is BackendDevisListItem => v !== null);
}

function parseBackendClientRecord(row: unknown): BackendClientRecord | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const idRaw = r.id ?? r.clientId;
  const email = String(r.clientEmail ?? r.email ?? "").trim();
  const ice = String(r.clientIce ?? r.ice ?? "").trim();
  const nom = String(r.clientNom ?? r.nom ?? r.name ?? "").trim();
  const tel = String(r.clientTelephone ?? r.telephone ?? r.phone ?? "").trim();
  const id =
    typeof idRaw === "string" && idRaw.length > 0
      ? idRaw
      : email
        ? `email:${email.toLowerCase()}`
        : ice
          ? `ice:${ice}`
          : nom
            ? `nom:${nom.toLowerCase()}`
            : "";
  if (!id) return null;
  return {
    id,
    clientNom: nom || undefined,
    clientEmail: email || undefined,
    clientTelephone: tel || undefined,
    clientIce: ice || undefined,
  };
}

/** Résultat de GET /clients : liste + indique si la réponse vient bien de l’API (liste vide = fiable). */
export type FetchClientsListResult = {
  clients: BackendClientRecord[];
  /** true si un GET /clients… a répondu 2xx : ne pas reconstruire la liste depuis les devis. */
  authoritativeFromApi: boolean;
};

/**
 * Liste des clients. Si `authoritativeFromApi` est false, l’endpoint n’a pas répondu OK (404 / erreur) —
 * l’UI peut alors dériver les contacts depuis les devis/factures.
 */
export async function fetchClientsListDetailed(): Promise<FetchClientsListResult> {
  const base = getApiBaseUrl();
  if (!base) return { clients: [], authoritativeFromApi: false };

  const token = getStoredAccessToken();
  if (!token) return { clients: [], authoritativeFromApi: false };

  const candidates = ["/clients", "/clients/list", "/clients/mine"];

  for (const path of candidates) {
    const res = await fetch(`${base}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });

    if (res.status === 404) continue;
    if (!res.ok) continue;

    const raw = (await res.json().catch(() => null)) as unknown;
    const list = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown[] }).items)
        ? ((raw as { items: unknown[] }).items as unknown[])
        : [];

    const clients = list
      .map((row) => parseBackendClientRecord(row))
      .filter((v): v is BackendClientRecord => v !== null);

    return { clients, authoritativeFromApi: true };
  }

  return { clients: [], authoritativeFromApi: false };
}

/**
 * Liste des clients (optionnel). Ne lance pas si l’endpoint n’existe pas — retourne [].
 */
export async function fetchClientsList(): Promise<BackendClientRecord[]> {
  const r = await fetchClientsListDetailed();
  return r.clients;
}

/** Ids générés côté front (liste dérivée e:/i:/n: ou fallback parse email:/ice:/nom:) — non PATCHables. */
export function isDerivedSyntheticClientId(id: string): boolean {
  return (
    /^(email|ice|nom):/i.test(id) ||
    /^e:/i.test(id) ||
    /^i:/i.test(id) ||
    /^n:/i.test(id)
  );
}

export async function updateClient(
  clientId: string,
  payload: BackendClientUpdatePayload,
): Promise<BackendClientRecord> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  if (isDerivedSyntheticClientId(clientId)) {
    throw new Error(
      "Ce client n’a pas d’identifiant serveur : active GET/PATCH /clients côté backend pour modifier.",
    );
  }

  const token = getStoredAccessToken();
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");

  const url = `${base}/clients/${encodeURIComponent(clientId)}`;
  const body = JSON.stringify(payload);

  const tryPatch = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    credentials: "include",
    body,
  });

  if (tryPatch.ok) {
    const raw = (await tryPatch.json().catch(() => null)) as unknown;
    const parsed = parseBackendClientRecord(raw);
    if (parsed) return parsed;
    return {
      id: clientId,
      clientNom: payload.clientNom,
      clientEmail: payload.clientEmail,
      clientTelephone: payload.clientTelephone,
      clientIce: payload.clientIce,
    };
  }

  if (tryPatch.status !== 405) {
    return parseApiError(tryPatch, `PATCH /clients/${clientId}`, payload);
  }

  const tryPut = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    credentials: "include",
    body,
  });

  if (!tryPut.ok) return parseApiError(tryPut, `PUT /clients/${clientId}`, payload);

  const rawPut = (await tryPut.json().catch(() => null)) as unknown;
  const parsedPut = parseBackendClientRecord(rawPut);
  if (parsedPut) return parsedPut;
  return {
    id: clientId,
    clientNom: payload.clientNom,
    clientEmail: payload.clientEmail,
    clientTelephone: payload.clientTelephone,
    clientIce: payload.clientIce,
  };
}

export async function deleteClient(clientId: string): Promise<void> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  if (isDerivedSyntheticClientId(clientId)) {
    throw new Error(
      "Ce client n’a pas d’identifiant serveur : impossible de supprimer sans DELETE /clients côté API.",
    );
  }

  const token = getStoredAccessToken();
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");

  const res = await fetch(`${base}/clients/${encodeURIComponent(clientId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });

  if (res.ok) return;
  return parseApiError(res, `DELETE /clients/${clientId}`);
}

export async function fetchDevisById(devisId: string): Promise<BackendDevisRecord> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const token = getStoredAccessToken();
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");

  const res = await fetch(`${base}/devis/${encodeURIComponent(devisId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });

  if (!res.ok) return parseApiError(res, `GET /devis/${devisId}`);

  const raw = (await res.json().catch(() => null)) as unknown;
  const parsed = parseBackendDevisRecord(raw);
  if (!parsed) throw new Error("Réponse devis invalide.");
  return parsed;
}

export async function fetchFactureById(factureId: string): Promise<BackendDevisRecord> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const token = getStoredAccessToken();
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");

  const res = await fetch(`${base}/factures/${encodeURIComponent(factureId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });

  if (!res.ok) return parseApiError(res, `GET /factures/${factureId}`);

  const raw = (await res.json().catch(() => null)) as unknown;
  const parsed = parseBackendDevisRecord(raw);
  if (!parsed) throw new Error("Réponse facture invalide.");
  return parsed;
}

export async function deleteDevis(devisId: string): Promise<void> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const token = getStoredAccessToken();
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");

  const res = await fetch(`${base}/devis/${encodeURIComponent(devisId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });

  if (!res.ok) return parseApiError(res, `DELETE /devis/${devisId}`);
}

/** Montants à appliquer sur la facture lors du transfert (optionnel, body JSON). */
export type TransferDevisToFactureTotals = {
  totalHt: number;
  montantTva: number;
  totalTtc: number;
};

/** Lignes ajustées envoyées avec le transfert (optionnel). */
export type TransferDevisToFactureLigne = {
  id: string;
  titre: string;
  description: string;
  quantite: number;
  prixUnitaireHt: number;
};

export async function deleteFacture(factureId: string): Promise<void> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const token = getStoredAccessToken();
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");

  const res = await fetch(`${base}/factures/${encodeURIComponent(factureId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });

  if (!res.ok) return parseApiError(res, `DELETE /factures/${factureId}`);
}

export async function transferDevisToFacture(
  devisId: string,
  options?: {
    totals?: TransferDevisToFactureTotals;
    lignes?: TransferDevisToFactureLigne[];
    tvaTaux?: number;
  },
): Promise<BackendDevisRecord> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const token = getStoredAccessToken();
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");

  const bodyPayload =
    options?.totals != null
      ? JSON.stringify({
          totals: {
            totalHt: options.totals.totalHt,
            montantTva: options.totals.montantTva,
            totalTtc: options.totals.totalTtc,
          },
          ...(options.lignes && options.lignes.length > 0
            ? {
                lignes: options.lignes.map((l) => ({
                  id: l.id,
                  titre: l.titre,
                  description: l.description,
                  quantite: l.quantite,
                  prixUnitaireHt: l.prixUnitaireHt,
                })),
              }
            : {}),
          ...(typeof options.tvaTaux === "number" && Number.isFinite(options.tvaTaux)
            ? { tvaTaux: options.tvaTaux }
            : {}),
        })
      : undefined;

  const candidates = [
    {
      url: `${base}/factures/from-devis/${encodeURIComponent(devisId)}`,
      method: "POST",
    },
    {
      url: `${base}/devis/${encodeURIComponent(devisId)}/transfer-to-facture`,
      method: "POST",
    },
    {
      url: `${base}/devis/${encodeURIComponent(devisId)}/convert`,
      method: "POST",
    },
  ] as const;

  let lastError: Error | null = null;

  for (const candidate of candidates) {
    const res = await fetch(candidate.url, {
      method: candidate.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(bodyPayload ? { "Content-Type": "application/json" } : {}),
      },
      credentials: "include",
      ...(bodyPayload ? { body: bodyPayload } : {}),
    });

    if (res.status === 404) continue;
    if (!res.ok) {
      try {
        return await parseApiError(
          res,
          `${candidate.method} ${candidate.url}`,
          bodyPayload ? JSON.parse(bodyPayload) : undefined,
        );
      } catch (e) {
        lastError =
          e instanceof Error ? e : new Error("Transfert devis -> facture impossible.");
        break;
      }
    }

    const raw = (await res.json().catch(() => null)) as unknown;
    const parsed = parseBackendDevisRecord(raw);
    if (!parsed) throw new Error("Réponse transfert facture invalide.");
    return parsed;
  }

  if (lastError) throw lastError;
  throw new Error(
    "Endpoint de transfert devis -> facture introuvable. Vérifie l'API backend.",
  );
}

async function sendDocumentByEmail(
  candidates: Array<{ url: string; method: "POST" | "PATCH" }>,
  payload: SendDocumentEmailPayload,
  contextLabel: string,
): Promise<void> {
  const token = getStoredAccessToken();
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");

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
        return await parseApiError(res, `${candidate.method} ${candidate.url}`, payload);
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(`Envoi email ${contextLabel} impossible.`);
        break;
      }
    }
    return;
  }

  if (lastError) throw lastError;
  throw new Error(`Endpoint email ${contextLabel} introuvable. Vérifie l'API backend.`);
}

export async function sendDevisEmail(
  devisId: string,
  payload: SendDocumentEmailPayload,
): Promise<void> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  await sendDocumentByEmail(
    [
      {
        url: `${base}/devis/${encodeURIComponent(devisId)}/send-email`,
        method: "POST",
      },
      {
        url: `${base}/devis/${encodeURIComponent(devisId)}/email`,
        method: "POST",
      },
      {
        url: `${base}/devis/${encodeURIComponent(devisId)}/send`,
        method: "POST",
      },
    ],
    payload,
    "devis",
  );
}

export async function sendFactureEmail(
  factureId: string,
  payload: SendDocumentEmailPayload,
): Promise<void> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  await sendDocumentByEmail(
    [
      {
        url: `${base}/factures/${encodeURIComponent(factureId)}/send-email`,
        method: "POST",
      },
      {
        url: `${base}/factures/${encodeURIComponent(factureId)}/email`,
        method: "POST",
      },
      {
        url: `${base}/factures/${encodeURIComponent(factureId)}/send`,
        method: "POST",
      },
    ],
    payload,
    "facture",
  );
}

export async function downloadDevisPdf(devisId: string, fallbackName?: string): Promise<void> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const token = getStoredAccessToken();
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");

  const res = await fetch(`${base}/devis/${encodeURIComponent(devisId)}/pdf`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });

  if (!res.ok) return parseApiError(res, `GET /devis/${devisId}/pdf`);

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const safeName = (fallbackName || "devis").replace(/[^a-zA-Z0-9_-]/g, "-");
  anchor.download = `${safeName}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadFacturePdf(
  factureId: string,
  fallbackName?: string,
): Promise<void> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const token = getStoredAccessToken();
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");

  const res = await fetch(`${base}/factures/${encodeURIComponent(factureId)}/pdf`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });

  if (!res.ok) return parseApiError(res, `GET /factures/${factureId}/pdf`);

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const safeName = (fallbackName || "facture").replace(/[^a-zA-Z0-9_-]/g, "-");
  anchor.download = `${safeName}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
