import { NextResponse } from "next/server";
import {
  normalizeWhatsAppTemplates,
  type WhatsAppTemplate,
} from "@/lib/whatsapp/whatsapp-templates";

const WHATCHIMP_TEMPLATE_LIST_URL =
  "https://app.whatchimp.com/api/v1/whatsapp/template/list";

function log(step: string, detail?: string) {
  const suffix = detail ? ` — ${detail}` : "";
  console.log(`[api/whatsapp/templates] ${step}${suffix}`);
}

async function fetchFromNest(
  authorization: string | null,
): Promise<{ templates: WhatsAppTemplate[] } | null> {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!base) {
    log("Nest proxy skipped", "NEXT_PUBLIC_API_URL missing");
    return null;
  }

  const url = `${base}/whatsapp/templates`;
  log("Nest proxy", `GET ${url}`);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    cache: "no-store",
  });

  const rawText = await res.text().catch(() => "");
  log("Nest proxy response", `status=${res.status} body=${rawText.slice(0, 300)}`);

  if (!res.ok) {
    throw new Error(
      rawText
        ? (() => {
            try {
              const parsed = JSON.parse(rawText) as { message?: string };
              return typeof parsed.message === "string"
                ? parsed.message
                : rawText.slice(0, 200);
            } catch {
              return rawText.slice(0, 200);
            }
          })()
        : `Backend Nest erreur ${res.status}`,
    );
  }

  const data = (rawText ? JSON.parse(rawText) : {}) as {
    templates?: WhatsAppTemplate[];
  };
  return { templates: Array.isArray(data.templates) ? data.templates : [] };
}

async function fetchWhatChimpDirect(
  apiKey: string,
  phoneNumberId: string,
): Promise<WhatsAppTemplate[]> {
  const errors: string[] = [];
  const getUrl = `${WHATCHIMP_TEMPLATE_LIST_URL}?apiToken=${encodeURIComponent(apiKey)}&phone_number_id=${encodeURIComponent(phoneNumberId)}`;

  log("WhatChimp direct", `GET ${WHATCHIMP_TEMPLATE_LIST_URL}?apiToken=***&phone_number_id=${phoneNumberId}`);

  try {
    const res = await fetch(getUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const rawText = await res.text().catch(() => "");
    log("WhatChimp GET", `status=${res.status} body=${rawText.slice(0, 300)}`);

    if (res.ok) {
      const raw = rawText ? JSON.parse(rawText) : {};
      const templates = normalizeWhatsAppTemplates(raw);
      log("WhatChimp GET normalized", `count=${templates.length}`);
      if (templates.length > 0) return templates;
      errors.push("GET: liste vide après normalisation");
    } else {
      errors.push(`GET ${res.status}`);
    }
  } catch (e) {
    errors.push(`GET: ${e instanceof Error ? e.message : "request failed"}`);
  }

  log("WhatChimp direct", "POST fallback");
  try {
    const body = new URLSearchParams({
      apiToken: apiKey,
      phone_number_id: phoneNumberId,
    });
    const res = await fetch(WHATCHIMP_TEMPLATE_LIST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
      cache: "no-store",
    });
    const rawText = await res.text().catch(() => "");
    log("WhatChimp POST", `status=${res.status} body=${rawText.slice(0, 300)}`);

    if (res.ok) {
      const raw = rawText ? JSON.parse(rawText) : {};
      const templates = normalizeWhatsAppTemplates(raw);
      log("WhatChimp POST normalized", `count=${templates.length}`);
      if (templates.length > 0) return templates;
      errors.push("POST: liste vide après normalisation");
    } else {
      errors.push(`POST ${res.status}`);
    }
  } catch (e) {
    errors.push(`POST: ${e instanceof Error ? e.message : "request failed"}`);
  }

  throw new Error(
    errors.length > 0
      ? `Impossible de charger les templates WhatChimp (${errors.join("; ")})`
      : "Impossible de charger les templates WhatChimp.",
  );
}

export async function GET(req: Request) {
  const authorization = req.headers.get("authorization");
  log("request", authorization ? "with Authorization" : "no Authorization header");

  try {
    if (authorization) {
      const fromNest = await fetchFromNest(authorization);
      if (fromNest) {
        log("success via Nest", `templates=${fromNest.templates.length}`);
        return NextResponse.json(fromNest);
      }
    }

    const apiKey = process.env.WHATCHIMP_API_KEY?.trim();
    const phoneNumberId = process.env.WHATCHIMP_PHONE_NUMBER_ID?.trim();

    if (!apiKey) {
      log("error", "WHATCHIMP_API_KEY missing in Next.js env and Nest proxy unavailable");
      return NextResponse.json(
        {
          error:
            "WHATCHIMP_API_KEY manquante. Configurez-la dans le backend Nest (.env) ou transmettez un JWT valide.",
        },
        { status: 500 },
      );
    }
    if (!phoneNumberId) {
      log("error", "WHATCHIMP_PHONE_NUMBER_ID missing");
      return NextResponse.json(
        { error: "WHATCHIMP_PHONE_NUMBER_ID manquante côté serveur." },
        { status: 500 },
      );
    }

    const templates = await fetchWhatChimpDirect(apiKey, phoneNumberId);
    log("success via WhatChimp direct", `templates=${templates.length}`);
    return NextResponse.json({ templates });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur templates.";
    log("error", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
