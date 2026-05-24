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
  /** Description courte (colonne « Détail » du PDF ; **gras** supporté). */
  detail: string;
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

  section2Intro: string;
  section2Approche: string;
  section2Bloc1Titre: string;
  section2Bloc1Intro: string;
  section2Bloc1Points: string[];
  section2Bloc2Titre: string;
  section2Bloc2Intro: string;
  section2Bloc2Points: string[];
  section2Conclusion: string;

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

export const DEFAULT_SECTION2_INTRO =
  "Mise en place de campagnes Meta Ads ciblant les parents correspondant à la tranche d\u2019âge des élèves, selon la zone géographique de l\u2019établissement.";

export const DEFAULT_SECTION2_APPROCHE =
  "Notre approche repose sur **deux volets essentiels pour garantir la performance du système** :";

export const DEFAULT_SECTION2_BLOC1_TITRE = "1. Création & Paramétrage des campagnes";

export const DEFAULT_SECTION2_BLOC1_INTRO =
  "Mise en place stratégique des campagnes dès le démarrage, incluant :";

export const DEFAULT_SECTION2_BLOC1_POINTS = [
  "Paramétrage précis des audiences adaptées au secteur éducatif",
  "Création des messages et visuels alignés avec le positionnement de l\u2019établissement",
  "Structuration des campagnes pour capter des parents réellement intéressés",
];

export const DEFAULT_SECTION2_BLOC2_TITRE = "2. Optimisation continue des performances";

export const DEFAULT_SECTION2_BLOC2_INTRO =
  "Suivi et optimisation des campagnes de manière régulière afin de :";

export const DEFAULT_SECTION2_BLOC2_POINTS = [
  "Améliorer la qualité des prospects générés",
  "Ajuster les audiences et les messages en fonction des résultats",
  "Garantir un flux constant de parents qualifiés, semaine après semaine",
];

export const DEFAULT_SECTION2_CONCLUSION =
  "Les campagnes seront ainsi optimisées en continu afin d\u2019assurer un **flux régulier et maîtrisé de prospects qualifiés.**";

/** Ancien paragraphe unique (section 2) — remplacé par la structure à 2 volets. */
export const LEGACY_SECTION2_TEXTE =
  "Mise en place de campagnes Meta Ads ciblant les parents correspondant à la tranche d'âge des élèves et à la zone géographique de l'établissement. Optimisation continue pour garantir un équilibre entre volume et qualité des prospects.";

export function defaultSection2Fields(): Pick<
  PropositionFormState,
  | "section2Intro"
  | "section2Approche"
  | "section2Bloc1Titre"
  | "section2Bloc1Intro"
  | "section2Bloc1Points"
  | "section2Bloc2Titre"
  | "section2Bloc2Intro"
  | "section2Bloc2Points"
  | "section2Conclusion"
> {
  return {
    section2Intro: DEFAULT_SECTION2_INTRO,
    section2Approche: DEFAULT_SECTION2_APPROCHE,
    section2Bloc1Titre: DEFAULT_SECTION2_BLOC1_TITRE,
    section2Bloc1Intro: DEFAULT_SECTION2_BLOC1_INTRO,
    section2Bloc1Points: [...DEFAULT_SECTION2_BLOC1_POINTS],
    section2Bloc2Titre: DEFAULT_SECTION2_BLOC2_TITRE,
    section2Bloc2Intro: DEFAULT_SECTION2_BLOC2_INTRO,
    section2Bloc2Points: [...DEFAULT_SECTION2_BLOC2_POINTS],
    section2Conclusion: DEFAULT_SECTION2_CONCLUSION,
  };
}

export function isLegacySection2Text(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return (
    t === LEGACY_SECTION2_TEXTE.trim().toLowerCase() ||
    (t.includes("meta ads") &&
      t.includes("optimisation continue") &&
      !t.includes("deux volets"))
  );
}

type PropositionFormLegacy = PropositionFormState & { section2Texte?: string };

export function upgradePropositionSection2ToLatest(
  data: PropositionFormLegacy,
): PropositionFormState {
  if (typeof data.section2Intro === "string" && data.section2Intro.trim()) {
    const { section2Texte: _removed, ...rest } = data;
    return rest as PropositionFormState;
  }

  const defaults = defaultSection2Fields();
  const legacy = data.section2Texte?.trim() ?? "";

  if (legacy && !isLegacySection2Text(legacy)) {
    return {
      ...data,
      ...defaults,
      section2Intro: legacy,
      section2Texte: undefined,
    } as PropositionFormState;
  }

  const { section2Texte: _removed, ...rest } = data;
  return { ...rest, ...defaults };
}

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

const VIDEO_TARIF_DETAIL_SUFFIX = "(Espagne, orientation, accompagnement)";

/** Ligne tarif « Création de contenu vidéo » — alignée sur section 1 (videosMin / videosMax). */
export function isVideoContentTarifService(service: string): boolean {
  return /création de contenu vidéo/i.test(service.trim());
}

export function formatVideoTarifDetail(videosMin: number, videosMax: number): string {
  const min = Math.max(1, videosMin);
  const max = Math.max(min, videosMax);
  const count =
    min === max ? `**${min} vidéos**` : `**${min} à ${max} vidéos**`;
  return `${count} ${VIDEO_TARIF_DETAIL_SUFFIX}`;
}

/** Détail généré automatiquement (modifiable manuellement si le suffixe change). */
export function isAutoVideoTarifDetail(detail: string): boolean {
  const t = detail.trim();
  if (!t) return true;
  if (!t.includes(VIDEO_TARIF_DETAIL_SUFFIX)) return false;
  return /\*\*\d+(\s+à\s+\d+)?\s+vidéos\*\*/i.test(t);
}

export function syncVideoTarifDetailInLignes(
  lignes: PropositionTarifLigne[],
  videosMin: number,
  videosMax: number,
  options?: { force?: boolean },
): PropositionTarifLigne[] {
  const nextDetail = formatVideoTarifDetail(videosMin, videosMax);
  return lignes.map((l) => {
    if (!isVideoContentTarifService(l.service)) return l;
    if (!options?.force && !isAutoVideoTarifDetail(l.detail)) return l;
    if (l.detail === nextDetail) return l;
    return { ...l, detail: nextDetail };
  });
}

/** Détail affiché (PDF / aperçu) — vidéos toujours liées à la section 1. */
export function resolveTarifLineDetail(
  ligne: PropositionTarifLigne,
  videosMin: number,
  videosMax: number,
): string {
  if (isVideoContentTarifService(ligne.service)) {
    return formatVideoTarifDetail(videosMin, videosMax);
  }
  return ligne.detail;
}

export const DEFAULT_TARIFS_LIGNES: Omit<PropositionTarifLigne, "id">[] = [
  {
    service: "Gestion Publicitaire (Facebook & Instagram)",
    detail: "Gestion et optimisation des campagnes",
    prixInitial: "5 550 / mois",
    prixOffert: "4 000 / mois",
  },
  {
    service: "Funnel Marketing (Tunnel de vente)",
    detail: "Création & paramétrage du système",
    prixInitial: "4 000 MAD",
    prixOffert: "3 000 MAD",
  },
  {
    service: "Automatisation CRM (intégration + automatiques)",
    detail: "Structuration des leads, suivi et automatisation du système",
    prixInitial: "2 750",
    prixOffert: "Offert",
  },
  {
    service: "Création de contenu vidéo",
    detail: formatVideoTarifDetail(20, 25),
    prixInitial: "1 450 / 1 vidéo",
    prixOffert: "1 200 / 1 vidéo",
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

/** Ajoute `detail` aux lignes tarif anciennes (localStorage / API sans le champ). */
export function normalizeTarifsLignes(
  lignes: PropositionTarifLigne[],
): PropositionTarifLigne[] {
  const defaultByService = new Map(
    DEFAULT_TARIFS_LIGNES.map((d) => [d.service.trim().toLowerCase(), d.detail]),
  );
  return lignes.map((l) => {
    const detail =
      typeof l.detail === "string"
        ? l.detail
        : defaultByService.get(l.service.trim().toLowerCase()) ?? "";
    return { ...l, detail };
  });
}

/** Introduction + sections stratégie + colonne Détail tarifs. */
export function upgradePropositionContentToLatest(
  data: PropositionFormLegacy,
): PropositionFormState {
  let upgraded = upgradePropositionSection2ToLatest(
    upgradePropositionSection1ToLatest(upgradePropositionIntroToLatest(data)),
  );
  const tarifsLignes = syncVideoTarifDetailInLignes(
    normalizeTarifsLignes(upgraded.tarifsLignes),
    upgraded.videosMin,
    upgraded.videosMax,
    { force: true },
  );
  if (tarifsLignes !== upgraded.tarifsLignes) {
    upgraded = { ...upgraded, tarifsLignes };
  }
  return upgraded;
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

    ...defaultSection2Fields(),

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
