export type DevisLineInput = {
  id: string;
  designationTitle: string;
  designationDetail: string;
  quantity: number;
  prixUnitaireHT: number;
};

export type DevisFormState = {
  companyName: string;
  companyRc: string;
  companyCnie: string;
  companyIce: string;
  companyTp: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  clientNom: string;
  clientIce: string;
  devisNumber: string;
  dateEmission: string;
  lines: DevisLineInput[];
  tvaExempt: boolean;
  tvaRatePercent: number;
  paymentMode: string;
  paymentBank: string;
  paymentTitulaire: string;
  paymentRib: string;
  tvaNote: string;
};

export type DevisPdfPayload = DevisFormState & {
  totals: {
    totalHT: number;
    tvaAmount: number;
    totalTTC: number;
  };
};
