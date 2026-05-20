"use client";

import { Fragment, type ReactNode } from "react";
import { applyPropositionTemplateVars } from "./proposition-types";

/** Affiche un texte avec **gras** (après remplacement des {{variables}}). */
export function renderPropositionRichText(
  text: string,
  etablissement: string,
  objectif: number,
): ReactNode {
  const resolved = applyPropositionTemplateVars(text, etablissement, objectif);
  const parts = resolved.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, i) => {
    const boldMatch = /^\*\*(.+)\*\*$/.exec(part);
    if (boldMatch) {
      return <strong key={i}>{boldMatch[1]}</strong>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
