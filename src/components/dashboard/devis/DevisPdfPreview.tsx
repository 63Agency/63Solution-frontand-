"use client";

import type { DevisFormState } from "./devis-types";
import { ligneTotalHt } from "./devis-types";

function formatMad(n: number): string {
  return (
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + " MAD"
  );
}

type Props = {
  data: DevisFormState;
  totalHt: number;
  montantTva: number;
  totalTtc: number;
};

export function DevisPdfPreview({ data, totalHt, montantTva, totalTtc }: Props) {
  const dateFr = (() => {
    const [y, m, d] = data.dateEmission.split("-");
    if (y && m && d) return `${d}/${m}/${y}`;
    return data.dateEmission;
  })();

  return (
    <div
      id="devis-pdf-preview"
      className="border border-neutral-300 bg-white p-8 text-neutral-900 shadow-sm print:border-0 print:shadow-none"
      style={{ fontFamily: "system-ui, Segoe UI, Roboto, Arial, sans-serif" }}
    >
      <div className="mb-8 flex flex-col justify-between gap-8 md:flex-row md:items-start">
        <div className="max-w-md">
          <h1 className="mb-2 text-3xl font-bold tracking-tight">DEVIS</h1>
          <p className="text-lg font-bold">{data.societeNom || "—"}</p>
          <div className="mt-3 space-y-0.5 text-sm leading-relaxed text-neutral-700">
            <p>RC : {data.societeRc || "—"}</p>
            <p>CNIE : {data.societeCnie || "—"}</p>
            <p>ICE : {data.societeIce || "—"}</p>
            <p>TP : {data.societeTp || "—"}</p>
            <p>
              <span className="font-semibold">Adresse :</span>{" "}
              {data.societeAdresse || "—"}
            </p>
            <p>
              <span className="font-semibold">Téléphone :</span>{" "}
              {data.societeTelephone || "—"}
            </p>
            <p>
              <span className="font-semibold">E-mail :</span>{" "}
              {data.societeEmail || "—"}
            </p>
          </div>
        </div>
        <div className="text-right text-sm md:min-w-[220px]">
          <p className="font-bold">Devis pour :</p>
          <p className="mt-2">
            <span className="font-semibold">Nom :</span>{" "}
            <span className="font-bold">{data.clientNom || "—"}</span>
          </p>
          <p className="mt-1">
            <span className="font-semibold">ICE :</span>{" "}
            {data.clientIce || "********"}
          </p>
          <p className="mt-2">
            <span className="font-semibold">Devis n° :</span>{" "}
            <span className="font-bold">{data.devisNumero || "—"}</span>
          </p>
          <p className="mt-1">
            <span className="font-semibold">Date d&apos;émission :</span>{" "}
            <span className="font-bold">{dateFr}</span>
          </p>
        </div>
      </div>

      <table className="w-full border-collapse border border-neutral-900 text-sm">
        <thead>
          <tr className="bg-neutral-900 text-white">
            <th className="border border-neutral-900 px-3 py-2 text-left font-semibold">
              Désignation
            </th>
            <th className="w-24 border border-neutral-900 px-2 py-2 text-center font-semibold">
              Quantité
            </th>
            <th className="w-36 border border-neutral-900 px-2 py-2 text-right font-semibold">
              Prix Unitaire HT
            </th>
            <th className="w-36 border border-neutral-900 px-2 py-2 text-right font-semibold">
              Total HT
            </th>
          </tr>
        </thead>
        <tbody>
          {data.lignes.map((ligne, i) => (
            <tr
              key={ligne.id}
              className={i % 2 === 0 ? "bg-neutral-50" : "bg-white"}
            >
              <td className="border border-neutral-300 px-3 py-3 align-top">
                <p className="font-bold uppercase">
                  {ligne.titre || "—"}
                </p>
                {ligne.description ? (
                  <p className="mt-1 text-neutral-700">{ligne.description}</p>
                ) : null}
              </td>
              <td className="border border-neutral-300 px-2 py-3 text-center align-top">
                {ligne.quantite}
              </td>
              <td className="border border-neutral-300 px-2 py-3 text-right align-top whitespace-nowrap">
                {formatMad(ligne.prixUnitaireHt)}
              </td>
              <td className="border border-neutral-300 px-2 py-3 text-right align-top font-medium whitespace-nowrap">
                {formatMad(ligneTotalHt(ligne))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.mentionTva ? (
        <p className="mt-3 max-w-3xl text-xs italic text-neutral-600 underline">
          {data.mentionTva}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-8 md:flex-row md:justify-between">
        <div className="max-w-md text-sm">
          <p className="font-bold">Modalités de paiement :</p>
          <div className="mt-2 space-y-1 text-neutral-800">
            <p>
              <span className="font-semibold">Mode de paiement :</span>{" "}
              {data.paiementMode}
            </p>
            <p>
              <span className="font-semibold">Banque :</span>{" "}
              {data.paiementBanque}
            </p>
            <p>
              <span className="font-semibold">Titulaire :</span>{" "}
              {data.paiementTitulaire}
            </p>
            <p>
              <span className="font-semibold">RIB :</span> {data.paiementRib}
            </p>
          </div>
        </div>
        <div className="w-full max-w-xs text-sm md:self-end">
          <table className="w-full border-collapse">
            <tbody>
              <tr className="bg-neutral-100">
                <td className="border border-neutral-300 px-3 py-2 font-semibold">
                  Total HT
                </td>
                <td className="border border-neutral-300 px-3 py-2 text-right font-medium">
                  {formatMad(totalHt)}
                </td>
              </tr>
              <tr>
                <td className="border border-neutral-300 px-3 py-2 font-semibold">
                  TVA {data.tvaTaux}%
                </td>
                <td className="border border-neutral-300 px-3 py-2 text-right font-medium">
                  {formatMad(montantTva)}
                </td>
              </tr>
              <tr className="bg-neutral-100">
                <td className="border border-neutral-300 px-3 py-2 font-bold">
                  Total TTC
                </td>
                <td className="border border-neutral-300 px-3 py-2 text-right font-bold">
                  {formatMad(totalTtc)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
