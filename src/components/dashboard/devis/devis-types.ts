/** Identité légale fixe — ne pas exposer à l’édition dans le formulaire devis. */
export const AGENCE_63 = {
  nom: "63 AGENCY",
  rc: "162821",
  cnie: "BE925205",
  ice: "003071765000061",
  tp: "32401025",
  adresse: "179 Bd La resistance, CASABLANCA, Maroc",
  telephone: "+212 6 06 67 67 10",
  email: "Contact@63agency.ma",
} as const;

export type DevisLigne = {
  id: string;
  titre: string;
  description: string;
  quantite: number;
  prixUnitaireHt: number;
};

export type DevisFormState = {
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
  devisNumero: string;
  dateEmission: string;
  lignes: DevisLigne[];
  tvaTaux: number;
  mentionTva: string;
  paiementMode: string;
  paiementBanque: string;
  paiementTitulaire: string;
  paiementRib: string;
};

export const LIGNES_FIXES_TEMPLATE: Omit<DevisLigne, "id" | "quantite">[] = [
  {
    titre: "CRÉATION DE CONTENUS VIDÉOS",
    description:
      "Production de contenus vidéos adaptés à votre activité, conçus pour capter l'attention, renforcer votre image de marque et générer de l'intérêt auprès de votre audience cible.",
    prixUnitaireHt: 1200,
  },
  {
    titre: "CONCEPTION & MISE EN PLACE LE TUNNEL DE VENTE",
    description:
      "Création d'un tunnel de conversion permettant de qualifier les prospects, structurer leur parcours et maximiser les demandes réellement intéressées.",
    prixUnitaireHt: 2500,
  },
  {
    titre: "GESTION & OPTIMISATION LES CAMPAGNES PUBLICITAIRES SUR FACEBOOK ET INSTAGRAM",
    description:
      "Paramétrage, pilotage et optimisation continue des campagnes publicitaires sur les plateformes digitales afin d'atteindre des prospects qualifiés et améliorer la performance globale.",
    prixUnitaireHt: 4500,
  },
];

export const defaultDevisForm = (): DevisFormState => ({
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
  devisNumero: "",
  dateEmission: new Date().toISOString().slice(0, 10),
  lignes: LIGNES_FIXES_TEMPLATE.map((ligne) => ({
    id: crypto.randomUUID(),
    titre: ligne.titre,
    description: ligne.description,
    quantite: 1,
    prixUnitaireHt: ligne.prixUnitaireHt,
  })),
  tvaTaux: 20,
  mentionTva:
    "Montant en dirhams exonéré de la TVA (Art. 89 - II - 1° c. Code Général des Impôts)",
  paiementMode: "Virement bancaire",
  paiementBanque: "CIH BANK",
  paiementTitulaire: "SAAD CHAHOUBI",
  paiementRib: "230 780 4480573211002800 23",
});

export function ligneTotalHt(l: DevisLigne): number {
  const q = Number.isFinite(l.quantite) ? l.quantite : 0;
  const p = Number.isFinite(l.prixUnitaireHt) ? l.prixUnitaireHt : 0;
  return Math.round(q * p * 100) / 100;
}
