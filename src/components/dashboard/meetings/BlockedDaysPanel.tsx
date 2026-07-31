"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, CalendarOff, Loader2, Unlock, X } from "lucide-react";
import { toast } from "sonner";
import {
  createBlockedDay,
  deleteBlockedDay,
} from "@/lib/meetings/backend-meetings";
import {
  BLOCKED_DAY_REASON_PRESETS,
  formatBlockedDayLabel,
  formatBlockedDayShort,
  isBlockedDay,
} from "@/lib/meetings/blocked-days";
import { casablancaDayKey } from "@/lib/meetings/meeting-datetime";
import type { BlockedDay } from "@/lib/meetings/types";
import { cn } from "@/src/lib/utils";

type Props = {
  open: boolean;
  mode: "block" | "unblock" | "view";
  blockedDay?: BlockedDay | null;
  prefillDate?: string | null;
  blockedDays: BlockedDay[];
  onClose: () => void;
  onChanged: () => void;
};

export function BlockedDaysPanel({
  open,
  mode,
  blockedDay,
  prefillDate,
  blockedDays,
  onClose,
  onChanged,
}: Props) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmUnblock, setConfirmUnblock] = useState(false);

  const todayKey = casablancaDayKey();
  const isUnblock = mode === "unblock" && blockedDay;
  const isView = mode === "view" && blockedDay;
  const dateAlreadyBlocked = Boolean(date && isBlockedDay(date, blockedDays));

  useEffect(() => {
    if (!open) return;
    setDate(prefillDate ?? blockedDay?.date ?? "");
    setReason(blockedDay?.reason ?? "");
    setConfirmUnblock(false);
  }, [open, prefillDate, blockedDay]);

  const handleAdd = useCallback(async () => {
    const trimmed = date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      toast.error("Sélectionnez une date valide.");
      return;
    }
    if (isBlockedDay(trimmed, blockedDays)) {
      toast.error("Cette date est déjà indisponible.");
      return;
    }

    setSaving(true);
    try {
      await createBlockedDay({
        date: trimmed,
        reason: reason.trim() || undefined,
      });
      toast.success(`${formatBlockedDayShort(trimmed)} bloqué.`);
      onChanged();
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Impossible de bloquer cette date.",
      );
    } finally {
      setSaving(false);
    }
  }, [blockedDays, date, onChanged, onClose, reason]);

  const handleDelete = useCallback(async () => {
    if (!blockedDay) return;
    setSaving(true);
    try {
      await deleteBlockedDay(blockedDay.id);
      toast.success(`${formatBlockedDayShort(blockedDay.date)} est à nouveau disponible.`);
      onChanged();
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Impossible de débloquer cette date.",
      );
    } finally {
      setSaving(false);
      setConfirmUnblock(false);
    }
  }, [blockedDay, onChanged, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div
        className="w-full max-w-md rounded-t-2xl border border-zinc-700 bg-zinc-900 shadow-2xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="blocked-day-modal-title"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-xl",
                isUnblock || isView
                  ? "bg-red-500/15 text-red-300"
                  : "bg-zinc-800 text-zinc-400",
              )}
            >
              {isUnblock || isView ? (
                <CalendarOff className="size-4" />
              ) : (
                <Ban className="size-4" />
              )}
            </span>
            <div>
              <h3 id="blocked-day-modal-title" className="text-base font-semibold text-white">
                {isUnblock || isView ? "Date indisponible" : "Bloquer une date"}
              </h3>
              <p className="text-[11px] text-zinc-500">
                {isView
                  ? "Cette date a été bloquée par l'administrateur"
                  : isUnblock
                    ? "Cliquez pour rendre cette date disponible"
                    : "Aucun rendez-vous ne pourra être planifié"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Fermer"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {isView && blockedDay ? (
            <>
              <div className="rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-4">
                <p className="text-sm font-medium capitalize text-red-100">
                  {formatBlockedDayLabel(blockedDay.date)}
                </p>
                <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-red-300/70">
                  Motif
                </p>
                <p className="mt-1 text-sm leading-relaxed text-red-100/90">
                  {blockedDay.reason?.trim() ||
                    "Aucun motif n'a été précisé par l'administrateur."}
                </p>
              </div>
              <p className="text-xs leading-relaxed text-zinc-500">
                Les rendez-vous ne peuvent pas être planifiés sur cette date.
                Contactez un administrateur si vous avez besoin d&apos;une
                exception.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
              >
                Compris
              </button>
            </>
          ) : isUnblock ? (
            <>
              <div className="rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3">
                <p className="text-sm font-medium capitalize text-red-100">
                  {formatBlockedDayLabel(blockedDay.date)}
                </p>
                {blockedDay.reason ? (
                  <p className="mt-1 text-xs text-red-300/80">{blockedDay.reason}</p>
                ) : null}
              </div>

              {confirmUnblock ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleDelete()}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Unlock className="size-4" />
                    )}
                    Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmUnblock(false)}
                    className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmUnblock(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200 hover:bg-red-500/15"
                >
                  <Unlock className="size-4" />
                  Rendre disponible
                </button>
              )}
            </>
          ) : (
            <>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Date *
                </span>
                <input
                  type="date"
                  value={date}
                  min={todayKey}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20"
                />
              </label>

              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Motif (optionnel)
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {BLOCKED_DAY_REASON_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setReason(preset)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] transition",
                        reason === preset
                          ? "border-red-500/50 bg-red-500/15 text-red-200"
                          : "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200",
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Motif personnalisé…"
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20"
                />
              </div>

              {dateAlreadyBlocked ? (
                <p className="text-xs text-amber-400">Cette date est déjà bloquée.</p>
              ) : null}

              <button
                type="button"
                disabled={saving || !date || dateAlreadyBlocked}
                onClick={() => void handleAdd()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
                Bloquer cette date
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
