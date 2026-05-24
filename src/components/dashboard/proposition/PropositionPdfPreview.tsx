"use client";

/** Référence visuelle du template PDF — génération réelle côté API `GET /propositions/:id/pdf`. Voir docs/BACKEND-PROPOSITIONS.md */

import {
  applyPropositionTemplateVars,
  propositionDisplayTitle,
  resolveTarifLineDetail,
  type PropositionFormState,
} from "./proposition-types";
import { renderPropositionRichText } from "./renderPropositionRichText";

type Props = { data: PropositionFormState };

const S = {
  page: {
    border: "1px solid #d4d4d4",
    background: "#ffffff",
    padding: "40px",
    color: "#171717",
    fontFamily: "system-ui, Segoe UI, Roboto, Arial, sans-serif",
    fontSize: "15px",
    lineHeight: 1.55,
  } as const,
  hr: { margin: "24px 0", border: "none", borderTop: "1px solid #d4d4d4" } as const,
  h1: { textAlign: "center" as const, fontSize: "24px", fontWeight: 700, margin: 0 },
  h2: { textAlign: "center" as const, fontSize: "20px", fontWeight: 700, margin: 0 },
  h3: { fontSize: "18px", fontWeight: 700, margin: "24px 0 0" },
  p: { margin: "12px 0 0" },
  pFirst: { margin: "16px 0 0" },
  subTitle: { margin: "20px 0 0", fontSize: "16px", fontWeight: 700 },
  ul: { margin: "12px 0 0", paddingLeft: "24px", listStyleType: "disc" },
  li: { marginTop: "4px" },
  table: {
    marginTop: "24px",
    width: "100%",
    borderCollapse: "collapse" as const,
    border: "1px solid #262626",
    fontSize: "14px",
  },
  th: {
    border: "1px solid #262626",
    padding: "8px 12px",
    textAlign: "left" as const,
    fontWeight: 700,
    background: "#f5f5f5",
  },
  td: { border: "1px solid #262626", padding: "8px 12px" },
  pageBreak: { breakBefore: "page" as const, marginTop: "40px" },
  footer: { marginTop: "48px", textAlign: "center" as const, fontSize: "14px" },
};

export function PropositionPdfPreview({ data }: Props) {
  const etab = data.nomEtablissement.trim();
  const objectif = data.objectifProspects;
  const tpl = (t: string) => applyPropositionTemplateVars(t, etab, objectif);
  const tplRich = (t: string) => renderPropositionRichText(t, etab, objectif);

  return (
    <div id="proposition-pdf-preview" style={S.page}>
      <h1 style={S.h1}>{propositionDisplayTitle(data)}</h1>
      <p style={{ ...S.pFirst, textAlign: "center" }}>
        <strong>Préparée pour :</strong> {data.preparePour || "—"}
        <br />
        <strong>Nom de l&apos;établissement :</strong> {etab || "—"}
        <br />
        <strong>Préparée par :</strong> {data.preparePar || "—"}
      </p>

      <hr style={S.hr} />

      <h2 style={S.h2}>Introduction</h2>
      <p style={S.pFirst}>{tplRich(data.introParagraphe1)}</p>
      <p style={S.p}>{tplRich(data.introParagraphe2)}</p>

      <hr style={S.hr} />

      <h2 style={S.h2}>Notre stratégie et les étapes vers des résultats concrets</h2>
      <h3 style={S.h3}>1. Création de Contenu</h3>
      {data.section1Description
        .split(/\n\n+/)
        .filter((p) => p.trim())
        .map((paragraph, i) => (
          <p key={i} style={i === 0 ? S.p : S.p}>
            {paragraph.trim()}
          </p>
        ))}
      <p style={S.p}>
        Dans le cadre de cette collaboration,{" "}
        <strong>
          {data.videosMin} à {data.videosMax} vidéos
        </strong>{" "}
        seront produites, orientées autour de :
      </p>
      <ul style={S.ul}>
        {data.section1Topics.filter((t) => t.trim()).map((t) => (
          <li key={t} style={S.li}>
            {t}
          </li>
        ))}
      </ul>

      <div style={S.pageBreak} />

      <h3 style={{ ...S.h3, marginTop: 0 }}>2. Campagnes Publicitaires – Facebook &amp; Instagram</h3>
      <p style={S.p}>{data.section2Intro}</p>
      <p style={S.p}>
        {renderPropositionRichText(
          data.section2Approche,
          data.nomEtablissement,
          data.objectifProspects,
        )}
      </p>
      <p style={S.subTitle}>{data.section2Bloc1Titre}</p>
      <p style={S.p}>{data.section2Bloc1Intro}</p>
      <ul style={S.ul}>
        {data.section2Bloc1Points.filter((t) => t.trim()).map((t) => (
          <li key={t} style={S.li}>
            {t}
          </li>
        ))}
      </ul>
      <p style={S.subTitle}>{data.section2Bloc2Titre}</p>
      <p style={S.p}>{data.section2Bloc2Intro}</p>
      <ul style={S.ul}>
        {data.section2Bloc2Points.filter((t) => t.trim()).map((t) => (
          <li key={t} style={S.li}>
            {t}
          </li>
        ))}
      </ul>
      <p style={S.p}>
        {renderPropositionRichText(
          data.section2Conclusion,
          data.nomEtablissement,
          data.objectifProspects,
        )}
      </p>

      <hr style={S.hr} />

      <h3 style={S.h3}>3. Funnel Marketing</h3>
      <p style={S.p}>{data.section3Intro}</p>
      <ul style={S.ul}>
        {data.funnelCriteres.filter((t) => t.trim()).map((t) => (
          <li key={t} style={S.li}>
            {t}
          </li>
        ))}
      </ul>
      <p style={S.p}>{data.section3Conclusion}</p>

      <hr style={S.hr} />

      <h3 style={S.h3}>4. Automatisation &amp; Suivi</h3>
      <ul style={S.ul}>
        {data.section4Points.filter((t) => t.trim()).map((t) => (
          <li key={t} style={S.li}>
            {t}
          </li>
        ))}
      </ul>
      <p style={S.p}>{data.section4Objectif}</p>

      <div style={S.pageBreak} />

      <h2 style={S.h2}>Tarifs Proposés</h2>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Service</th>
            <th style={S.th}>Détail</th>
            <th style={S.th}>Prix Initial (MAD)</th>
            <th style={S.th}>Prix Offert (MAD)</th>
          </tr>
        </thead>
        <tbody>
          {data.tarifsLignes.map((l) => {
            const detail = resolveTarifLineDetail(l, data.videosMin, data.videosMax);
            return (
            <tr key={l.id}>
              <td style={S.td}>{l.service}</td>
              <td style={S.td}>
                {detail.trim()
                  ? renderPropositionRichText(
                      detail,
                      data.nomEtablissement,
                      data.objectifProspects,
                    )
                  : "—"}
              </td>
              <td style={S.td}>{l.prixInitial}</td>
              <td style={S.td}>{l.prixOffert}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ ...S.p, fontSize: "14px", fontStyle: "italic" }}>{data.tarifsNoteMeta}</p>

      <hr style={S.hr} />

      <h2 style={S.h2}>Pourquoi Choisir 63 AGENCY</h2>
      <ul style={{ ...S.ul, marginTop: "16px" }}>
        {data.pourquoiChoisir.filter((t) => t.trim()).map((t) => (
          <li key={t} style={{ ...S.li, marginTop: "8px" }}>
            {t}
          </li>
        ))}
      </ul>

      <hr style={S.hr} />

      <h2 style={S.h2}>Prochaines Étapes</h2>
      <p style={S.pFirst}>{tpl(data.prochainesEtapes)}</p>

      <div style={S.footer}>
        <p style={{ fontWeight: 700, margin: 0 }}>{data.contactNom}</p>
        <p style={{ margin: "4px 0 0" }}>📞 {data.contactTelephone}</p>
        <p style={{ margin: "4px 0 0" }}>✉ {data.contactEmail}</p>
        <p style={{ margin: "12px 0 0", fontWeight: 600 }}>{data.contactTagline}</p>
      </div>
    </div>
  );
}
