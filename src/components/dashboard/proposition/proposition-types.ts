import { AGENCE_63 } from "../devis/devis-types";

export type PropositionPreparerId = "saad" | "sara" | "billal";

export type PropositionPreparer = {
  id: PropositionPreparerId;
  /** Libellé en-tête « Préparée par » */
  preparePar: string;
  contactNom: string;
  contactTelephone: string;
  contactEmail: string;
};

/** Personnes autorisées à préparer une proposition (contact bas de page synchronisé). */
export const PROPOSITION_PREPARERS: PropositionPreparer[] = [
  {
    id: "saad",
    preparePar: "Saâd - 63 Agency",
    contactNom: "Saâd CHAHOUBI",
    contactTelephone: "06 06 67 67 10",
    contactEmail: AGENCE_63.email,
  },
  {
    id: "sara",
    preparePar: "Sara - 63 Agency",
    contactNom: "Sara",
    contactTelephone: "07 20 007 007",
    contactEmail: AGENCE_63.email,
  },
  {
    id: "billal",
    preparePar: "Billal - 63 Agency",
    contactNom: "Billal",
    contactTelephone: "",
    contactEmail: AGENCE_63.email,
  },
];

export const DEFAULT_PROPOSITION_CONTACT_TAGLINE =
  "63 AGENCY – Génération de Leads & Marketing Digital";

export function applyPropositionPreparer(
  data: PropositionFormState,
  personId: PropositionPreparerId,
): PropositionFormState {
  const person = PROPOSITION_PREPARERS.find((p) => p.id === personId);
  if (!person) return data;
  return {
    ...data,
    prepareParPersonId: personId,
    preparePar: person.preparePar,
    contactNom: person.contactNom,
    contactTelephone: person.contactTelephone,
    contactEmail: person.contactEmail,
  };
}

export function resolvePropositionPreparerId(
  data: Pick<
    PropositionFormState,
    "prepareParPersonId" | "preparePar" | "contactNom"
  >,
): PropositionPreparerId {
  if (data.prepareParPersonId) {
    const known = PROPOSITION_PREPARERS.some((p) => p.id === data.prepareParPersonId);
    if (known) return data.prepareParPersonId;
  }
  const prepareNorm = data.preparePar.trim().toLowerCase();
  const byPreparePar = PROPOSITION_PREPARERS.find(
    (p) => p.preparePar.toLowerCase() === prepareNorm,
  );
  if (byPreparePar) return byPreparePar.id;
  const contactNorm = data.contactNom.trim().toLowerCase();
  const byContact = PROPOSITION_PREPARERS.find((p) =>
    contactNorm.startsWith(p.contactNom.toLowerCase()),
  );
  if (byContact) return byContact.id;
  return "saad";
}

export type PropositionTarifLigne = {
  id: string;
  service: string;
  prixInitial: string;
  prixOffert: string;
};

export type PropositionFormState = {
  societeNom: string;
  societeRc: string;
  societeCnie: string;
  societeIce: string;
  societeTp: string;
  societeAdresse: string;
  societeTelephone: string;
  societeEmail: string;
  /** Nom affiché sur la page Clients (souvent = établissement). */
  clientNom: string;
  clientIce: string;
  clientEmail: string;
  clientTelephone: string;
  propositionNumero: string;
  dateEmission: string;

  titreProposition: string;
  preparePour: string;
  nomEtablissement: string;
  prepareParPersonId: PropositionPreparerId;
  preparePar: string;

  introParagraphe1: string;
  introParagraphe2: string;
  objectifProspects: number;

  section1Description: string;
  videosMin: number;
  videosMax: number;
  section1Topics: string[];

  section2Texte: string;

  section3Intro: string;
  funnelCriteres: string[];
  section3Conclusion: string;

  section4Points: string[];
  section4Objectif: string;

  tarifsLignes: PropositionTarifLigne[];
  tarifsNoteMeta: string;

  pourquoiChoisir: string[];
  prochainesEtapes: string;

  contactNom: string;
  contactTelephone: string;
  contactEmail: string;
  contactTagline: string;
};

export const DEFAULT_SECTION1_DESCRIPTION =
  "Le contenu est le pilier central de la stratégie.\n\nIl vise à rassurer les parents, valoriser l\u2019image de l\u2019établissement et mettre en avant la pédagogie.";

export const DEFAULT_SECTION1_TOPICS = [
  "Présentation de l\u2019école et de sa vision",
  "Direction et équipe pédagogique",
  "Vie scolaire et activités des élèves",
  "Infrastructures et environnement",
  "Approche pédagogique et accompagnement des parents",
];

export const DEFAULT_FUNNEL_CRITERES = [
  "L'âge de l'enfant",
  "Le niveau scolaire recherché",
  "La localisation",
  "L'intention réelle d'inscription",
];

export const DEFAULT_SECTION4_POINTS = [
  "Connexion du funnel aux campagnes publicitaires",
  "Centralisation et structuration des leads",
  "Suivi clair et exploitable pour l'équipe",
];

export const DEFAULT_POURQUOI_CHOISIR = [
  "Expertise en génération de leads pour groupes scolaires et établissements éducatifs",
  "Système complet : contenu + publicité + funnel + automatisation",
  "Approche orientée qualité des leads, pas volume inutile",
  "Méthodologie claire, testée et optimisée",
];

export const DEFAULT_TARIFS_LIGNES: Omit<PropositionTarifLigne, "id">[] = [
  {
    service: "Gestion Publicitaire (Facebook & Instagram)",
    prixInitial: "5 550 / mois",
    prixOffert: "4 000 / mois (1er mois) après 4 500 / mois",
  },
  {
    service: "Funnel Marketing (Tunnel de vente)",
    prixInitial: "4 500",
    prixOffert: "3 500",
  },
  {
    service: "Automatisation CRM (intégration + automatiques)",
    prixInitial: "2 750",
    prixOffert: "Offert",
  },
  {
    service: "Création de contenu vidéo",
    prixInitial: "1 450 / 1 vidéo",
    prixOffert: "1 000 / 1 vidéo",
  },
];

export function newPropositionId(): string {
  return crypto.randomUUID();
}

export const DEFAULT_INTRO_PARAGRAPHE_1 =
  "Notre mission est d\u2019accompagner {{etablissement}} dans la mise en place d\u2019un système de génération de prospects qualifiés, destiné aux parents à la recherche d\u2019un établissement scolaire structuré et fiable.";

export const DEFAULT_INTRO_PARAGRAPHE_2 =
  "L\u2019objectif est de construire une machine d\u2019acquisition performante, capable de générer plus de {{objectif}} prospects qualifiés, en combinant contenu institutionnel, publicité ciblée et funnel de qualification.";

function normalizeIntroForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\u2018\u2019']/g, "'")
    .replace(/\{\{etablissement\}\}/gi, "")
    .replace(/\{\{objectif\}\}/gi, "")
    .replace(/\*\*/g, "")
    .trim();
}

/** Ancien modèle (inscriptions / administration) → nouveau texte Jabri / machine d'acquisition. */
export function isLegacyPropositionIntro(data: Pick<PropositionFormState, "introParagraphe1" | "introParagraphe2">): boolean {
  const p1 = normalizeIntroForCompare(data.introParagraphe1);
  const p2 = normalizeIntroForCompare(data.introParagraphe2);
  return (
    p1.includes("afin d'augmenter le nombre d'inscriptions") ||
    p1.includes("renforcer la notoriété") ||
    p2.includes("prêts à être contactés par votre équipe administrative") ||
    (p2.includes("l'objectif est de générer") && !p2.includes("machine d'acquisition"))
  );
}

/** Met à jour l'introduction si l'ancien texte par défaut est encore enregistré. */
export function upgradePropositionIntroToLatest(
  data: PropositionFormState,
): PropositionFormState {
  if (!isLegacyPropositionIntro(data)) return data;
  return {
    ...data,
    introParagraphe1: DEFAULT_INTRO_PARAGRAPHE_1,
    introParagraphe2: DEFAULT_INTRO_PARAGRAPHE_2,
  };
}

export function isLegacyPropositionSection1(data: Pick<PropositionFormState, "section1Description">): boolean {
  const d = data.section1Description.toLowerCase();
  return (
    d.includes("socle de toute campagne") ||
    d.includes("nous produirons des vidéos professionnelles") ||
    d.includes("mettant en valeur")
  );
}

export function upgradePropositionSection1ToLatest(
  data: PropositionFormState,
): PropositionFormState {
  if (!isLegacyPropositionSection1(data)) return data;
  return { ...data, section1Description: DEFAULT_SECTION1_DESCRIPTION };
}

/** Introduction + section 1 stratégie (textes modèles à jour). */
export function upgradePropositionContentToLatest(data: PropositionFormState): PropositionFormState {
  return upgradePropositionSection1ToLatest(upgradePropositionIntroToLatest(data));
}

export function defaultPropositionForm(): PropositionFormState {
  return {
    societeNom: AGENCE_63.nom,
    societeRc: AGENCE_63.rc,
    societeCnie: AGENCE_63.cnie,
    societeIce: AGENCE_63.ice,
    societeTp: AGENCE_63.tp,
    societeAdresse: AGENCE_63.adresse,
    societeTelephone: AGENCE_63.telephone,
    societeEmail: AGENCE_63.email,
    clientNom: "",
    clientIce: "",
    clientEmail: "",
    clientTelephone: "",
    propositionNumero: "",
    dateEmission: new Date().toISOString().slice(0, 10),

    titreProposition: "Proposition de Génération de Leads",
    preparePour: "",
    nomEtablissement: "",
    prepareParPersonId: "saad",
    preparePar: PROPOSITION_PREPARERS[0].preparePar,

    introParagraphe1: DEFAULT_INTRO_PARAGRAPHE_1,
    introParagraphe2: DEFAULT_INTRO_PARAGRAPHE_2,
    objectifProspects: 150,

    section1Description: DEFAULT_SECTION1_DESCRIPTION,
    videosMin: 20,
    videosMax: 25,
    section1Topics: [...DEFAULT_SECTION1_TOPICS],

    section2Texte:
      "Mise en place de campagnes Meta Ads ciblant les parents correspondant à la tranche d'âge des élèves et à la zone géographique de l'établissement. Optimisation continue pour garantir un équilibre entre volume et qualité des prospects.",

    section3Intro: "Mise en place d'un funnel de qualification permettant de filtrer automatiquement :",
    funnelCriteres: [...DEFAULT_FUNNEL_CRITERES],
    section3Conclusion:
      "Ainsi, seuls les prospects exploitables arrivent à l'administration de l'école.",

    section4Points: [...DEFAULT_SECTION4_POINTS],
    section4Objectif:
      "Objectif : réactivité, meilleur suivi et optimisation du taux d'inscription.",

    tarifsLignes: DEFAULT_TARIFS_LIGNES.map((l) => ({
      ...l,
      id: newPropositionId(),
    })),
    tarifsNoteMeta:
      "Le budget publicitaire (Meta Ads) est à prévoir séparément et sera directement payé via votre compte Meta avec carte bancaire.",

    pourquoiChoisir: [...DEFAULT_POURQUOI_CHOISIR],
    prochainesEtapes:
      "Nous serions ravis d'accompagner {{etablissement}} dans la mise en place de ce système de génération de prospects et de lancer rapidement les premières campagnes.",

    contactNom: PROPOSITION_PREPARERS[0].contactNom,
    contactTelephone: PROPOSITION_PREPARERS[0].contactTelephone,
    contactEmail: PROPOSITION_PREPARERS[0].contactEmail,
    contactTagline: DEFAULT_PROPOSITION_CONTACT_TAGLINE,
  };
}

/** Remplace les variables {{etablissement}} et {{objectif}} dans les textes. */
export function applyPropositionTemplateVars(
  text: string,
  etablissement: string,
  objectif: number,
): string {
  return text
    .replace(/\{\{etablissement\}\}/gi, etablissement || "votre établissement")
    .replace(/\{\{objectif\}\}/gi, String(objectif || 0));
}

export function propositionDisplayTitle(data: PropositionFormState): string {
  const base = data.titreProposition.trim() || "Proposition";
  const etab = data.nomEtablissement.trim();
  return etab ? `${base} – ${etab}` : base;
}

/** Extrait le premier montant numérique d'une cellule tarif (ex. « 4 000 / mois » → 4000). */
export function parseTarifAmountMad(value: string): number {
  const norm = value.trim().toLowerCase();
  if (!norm || norm === "offert" || norm === "gratuit" || norm === "—" || norm === "-") {
    return 0;
  }
  const compact = norm.replace(/\s/g, "");
  const match = compact.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return 0;
  return Number.parseFloat(match[1].replace(",", ".")) || 0;
}

/** Total indicatif : somme des prix offerts (ou initial si offert vide). */
export function computePropositionTotalMad(data: PropositionFormState): number {
  return data.tarifsLignes.reduce((sum, ligne) => {
    const offert = parseTarifAmountMad(ligne.prixOffert);
    const initial = parseTarifAmountMad(ligne.prixInitial);
    return sum + (offert > 0 ? offert : initial);
  }, 0);
}

export function formatPropositionTotalMad(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} MAD`;
}
