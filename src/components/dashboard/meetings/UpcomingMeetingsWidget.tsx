"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Loader2 } from "lucide-react";
import { fetchUpcomingMeetings } from "@/lib/meetings/backend-meetings";
import type { Meeting } from "@/lib/meetings/types";
import { MeetingStatusBadge } from "./MeetingBadges";

export function UpcomingMeetingsWidget() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchUpcomingMeetings()
      .then((items) => {
        if (!cancelled) {
          setMeetings(items.slice(0, 5));
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Impossible de charger les rendez-vous.",
          );
          setMeetings([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-emerald-400" aria-hidden />
          <h3 className="text-sm font-semibold text-white">
            Prochains rendez-vous
          </h3>
        </div>
        <Link
          href="/dashboard/calendrier"
          className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
        >
          Voir tout
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-zinc-500">
          <Loader2 className="size-4 animate-spin text-emerald-500" />
          <span className="text-sm">Chargement…</span>
        </div>
      ) : error ? (
        <p className="mt-4 text-sm text-red-400">{error}</p>
      ) : meetings.length === 0 ? (
        <p className="mt-6 text-center text-sm text-zinc-500">
          Aucun rendez-vous à venir cette semaine.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-800">
          {meetings.map((m) => {
            const d = new Date(m.meetingDate);
            return (
              <li key={m.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {m.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {m.contactName} ·{" "}
                    {d.toLocaleString("fr-FR", {
                      timeZone: "Africa/Casablanca",
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <MeetingStatusBadge status={m.status} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
