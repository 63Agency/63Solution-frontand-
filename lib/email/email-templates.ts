import type { WhatsAppTemplate } from "@/lib/whatsapp/whatsapp-templates";
import type { EmailTemplate } from "./types";

type ProfessionalVariant = {
  subject: string;
  html: string;
};

/**
 * Réécritures email pro pour les templates WhatsApp connus.
 * Même intention / contexte — pas le texte WhatsApp mot pour mot.
 */
const PROFESSIONAL_BY_NAME: Record<string, ProfessionalVariant> = {
  just_bonjour: {
    subject: "Prise de contact — 63 Agency",
    html: `<p>Bonjour {{name}},</p>
<p>J'espère que vous allez bien.</p>
<p>Je me permets de vous contacter de la part de <strong>63 Agency</strong>. N'hésitez pas à me répondre si vous souhaitez échanger ou si vous avez la moindre question.</p>
<p>Dans l'attente de votre retour,<br/>Cordialement,<br/>L'équipe 63 Agency</p>`,
  },
  bonjour: {
    subject: "Bonjour {{name}} — 63 Agency",
    html: `<p>Bonjour {{name}},</p>
<p>J'espère que vous vous portez bien.</p>
<p>Je vous contacte afin de faire le point et de voir comment nous pouvons vous accompagner. Je reste entièrement disponible pour en discuter à votre convenance.</p>
<p>Cordialement,<br/>L'équipe 63 Agency</p>`,
  },
  proposal_sent: {
    subject: "Votre proposition commerciale — 63 Agency",
    html: `<p>Bonjour {{name}},</p>
<p>Comme convenu, je vous adresse notre proposition commerciale.</p>
<p>Vous y trouverez le détail de notre accompagnement. Je reste à votre disposition pour toute précision ou pour planifier un échange.</p>
<p>Cordialement,<br/>L'équipe 63 Agency</p>`,
  },
  proposal_sent_status: {
    subject: "Suivi de votre proposition — 63 Agency",
    html: `<p>Bonjour {{name}},</p>
<p>Je me permets de revenir vers vous concernant la proposition que nous vous avons transmise.</p>
<p>Avez-vous pu en prendre connaissance ? Je reste disponible pour répondre à vos questions ou ajuster les éléments selon vos besoins.</p>
<p>Cordialement,<br/>L'équipe 63 Agency</p>`,
  },
  proposal_sent_2_: {
    subject: "Relance — votre proposition 63 Agency",
    html: `<p>Bonjour {{name}},</p>
<p>Sans réponse de votre part à notre précédente proposition, je me permets cette courte relance.</p>
<p>Si le moment n'est pas opportun, n'hésitez pas à me l'indiquer. Dans le cas contraire, je serai ravi d'échanger avec vous pour avancer.</p>
<p>Cordialement,<br/>L'équipe 63 Agency</p>`,
  },
  suivi: {
    subject: "Suite à notre échange — {{name}}",
    html: `<p>Bonjour {{name}},</p>
<p>Je me permets de revenir vers vous suite à notre dernier échange.</p>
<p>Seriez-vous disponible pour en discuter cette semaine ? Je m'adapte à vos disponibilités.</p>
<p>Cordialement,<br/>L'équipe 63 Agency</p>`,
  },
};

function normalizeTemplateKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function findProfessionalVariant(name: string): ProfessionalVariant | null {
  const key = normalizeTemplateKey(name);
  if (PROFESSIONAL_BY_NAME[key]) return PROFESSIONAL_BY_NAME[key];

  // match partiel (ex. proposal_sent_2, proposal_sent_status_v2)
  const entries = Object.entries(PROFESSIONAL_BY_NAME);
  for (const [known, variant] of entries) {
    if (key === known || key.startsWith(`${known}_`) || key.includes(known)) {
      return variant;
    }
  }
  return null;
}

function humanizeTemplateName(name: string): string {
  return name
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function waBodyToProfessionalHtml(body: string): string {
  const cleaned = body
    .replace(/\{\{\s*1\s*\}\}/g, "{{name}}")
    .replace(/[👋😊🙏✨🔥]+/g, "")
    .replace(/\r\n/g, "\n")
    .trim();

  const paragraphs = cleaned
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`);

  const intro = paragraphs.some((p) => /bonjour/i.test(p))
    ? ""
    : `<p>Bonjour {{name}},</p>`;

  const closing = /cordialement|bien à vous|salutations/i.test(cleaned)
    ? ""
    : `<p>Cordialement,<br/>L'équipe 63 Agency</p>`;

  return `${intro}${paragraphs.join("\n")}${closing}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Convertit un template WhatsApp → email pro (objet + HTML).
 * Même contexte métier, rédaction adaptée à l'email.
 */
export function whatsAppToProfessionalEmail(
  wa: WhatsAppTemplate,
): EmailTemplate {
  const known = findProfessionalVariant(wa.name);
  if (known) {
    return {
      id: `email-from-${wa.id}`,
      name: wa.name,
      subject: known.subject,
      html: known.html,
    };
  }

  const label = humanizeTemplateName(wa.name);
  const hasName =
    /\{\{\s*1\s*\}\}/.test(wa.body) || /\{\{\s*name\s*\}\}/i.test(wa.body);

  return {
    id: `email-from-${wa.id}`,
    name: wa.name,
    subject: hasName
      ? `${label} — {{name}}`
      : `${label} — 63 Agency`,
    html: waBodyToProfessionalHtml(wa.body || label),
  };
}

export function mapWhatsAppTemplatesToEmail(
  templates: WhatsAppTemplate[],
): EmailTemplate[] {
  const seen = new Set<string>();
  const out: EmailTemplate[] = [];
  for (const wa of templates) {
    const email = whatsAppToProfessionalEmail(wa);
    const key = email.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

/** Fallback si aucun template WhatsApp n'est disponible. */
export const BUILTIN_EMAIL_TEMPLATES: EmailTemplate[] = [
  whatsAppToProfessionalEmail({
    id: "just_bonjour",
    name: "just_bonjour",
    body: "Bonjour\nJ'espère que vous allez bien.",
  }),
  whatsAppToProfessionalEmail({
    id: "proposal_sent_status",
    name: "proposal_sent_status",
    body: "Proposition envoyée",
  }),
  whatsAppToProfessionalEmail({
    id: "proposal_sent_2_",
    name: "proposal_sent_2_",
    body: "Relance proposition",
  }),
];

export function emailTemplateHasNameVar(
  template: Pick<EmailTemplate, "subject" | "html">,
): boolean {
  return (
    /\{\{\s*name\s*\}\}/i.test(template.subject) ||
    /\{\{\s*name\s*\}\}/i.test(template.html)
  );
}

function stripHtmlPreview(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function emailTemplatePlainPreview(template: EmailTemplate): string {
  const body = stripHtmlPreview(template.html);
  return body || template.subject || "—";
}
