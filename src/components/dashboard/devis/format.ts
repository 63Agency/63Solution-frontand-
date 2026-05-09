export function formatMad(amount: number): string {
  return (
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + " MAD"
  );
}

export function lineTotalHT(line: {
  quantity: number;
  prixUnitaireHT: number;
}): number {
  return Math.round(line.quantity * line.prixUnitaireHT * 100) / 100;
}

export function computeTotals(
  lines: { quantity: number; prixUnitaireHT: number }[],
  tvaExempt: boolean,
  tvaRatePercent: number,
): { totalHT: number; tvaAmount: number; totalTTC: number } {
  const totalHT =
    Math.round(
      lines.reduce((s, l) => s + l.quantity * l.prixUnitaireHT, 0) * 100,
    ) / 100;
  const rate = tvaExempt ? 0 : Math.max(0, tvaRatePercent) / 100;
  const tvaAmount = Math.round(totalHT * rate * 100) / 100;
  const totalTTC = Math.round((totalHT + tvaAmount) * 100) / 100;
  return { totalHT, tvaAmount, totalTTC };
}
