"use client";

import { useRef, useState } from "react";
import { renderPropositionRichText } from "./renderPropositionRichText";

export type PropositionTemplateVar = "etablissement" | "objectif";

const VAR_TOKEN: Record<PropositionTemplateVar, string> = {
  etablissement: "{{etablissement}}",
  objectif: "{{objectif}}",
};

const VAR_LABEL: Record<PropositionTemplateVar, string> = {
  etablissement: "Nom établissement",
  objectif: "Objectif prospects",
};

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  etablissement: string;
  objectif: number;
  variables: PropositionTemplateVar[];
  rows?: number;
};

const fieldClass =
  "mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500";

const labelClass = "block text-[11px] font-semibold uppercase tracking-wide text-zinc-400";

const editBtnClass =
  "rounded border border-zinc-700 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-zinc-300 hover:bg-zinc-800";

export function PropositionTemplateField({
  label,
  value,
  onChange,
  etablissement,
  objectif,
  variables,
  rows = 4,
}: Props) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = (varKey: PropositionTemplateVar) => {
    const token = VAR_TOKEN[varKey];
    const el = textareaRef.current;
    if (!el) {
      onChange(value + (value.endsWith(" ") || !value ? "" : " ") + token);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="rounded-md border border-zinc-800/80 bg-zinc-950/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className={labelClass}>{label}</label>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className={editBtnClass}
        >
          {editing ? "Fermer" : "Modifier"}
        </button>
      </div>

      {!editing ? (
        <div className="mt-2">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
            {renderPropositionRichText(value, etablissement, objectif)}
          </p>
          {value.includes("{{") ? (
            <p className="mt-2 font-mono text-[10px] text-zinc-500">
              Modèle enregistré avec variables — cliquez Modifier pour éditer le texte source.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-zinc-500">
            Insérez des variables : elles seront remplacées par les valeurs du formulaire
            (établissement, objectif prospects).
          </p>
          <div className="flex flex-wrap gap-2">
            {variables.map((varKey) => (
              <button
                key={varKey}
                type="button"
                onClick={() => insertVariable(varKey)}
                className="rounded border border-indigo-700/50 bg-indigo-950/50 px-2 py-1 font-mono text-[10px] text-indigo-200 hover:bg-indigo-900/60"
                title={`Insérer ${VAR_TOKEN[varKey]}`}
              >
                + {VAR_TOKEN[varKey]}
                <span className="ml-1 text-zinc-500">({VAR_LABEL[varKey]})</span>
              </button>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            className={`${fieldClass} font-mono text-[13px]`}
            style={{ minHeight: rows * 24 }}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
          />
          <p className="rounded border border-zinc-800 bg-zinc-900/80 px-2 py-1.5 text-[11px] leading-relaxed text-zinc-400">
            <span className="font-semibold text-zinc-300">Aperçu : </span>
            {renderPropositionRichText(value, etablissement, objectif)}
          </p>
        </div>
      )}
    </div>
  );
}
