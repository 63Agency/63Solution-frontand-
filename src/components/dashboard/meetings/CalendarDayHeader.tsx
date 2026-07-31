"use client";

import type { BlockedDay } from "@/lib/meetings/types";
import { cn } from "@/src/lib/utils";

type Props = {
  label: string;
  meetingCount: number;
  blocked?: BlockedDay;
  onMeetingCountClick?: () => void;
};

export function CalendarDayHeader({
  label,
  meetingCount,
  blocked,
  onMeetingCountClick,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-1 px-0.5 py-0.5">
      <span className={cn("text-[12px]", blocked && "text-red-300/90")}>
        {label}
      </span>
      <div className="flex items-center gap-1">
        {meetingCount > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMeetingCountClick?.();
            }}
            className={cn(
              "inline-flex min-w-[18px] items-center justify-center rounded-full px-1 py-px text-[9px] font-bold tabular-nums transition",
              meetingCount >= 3
                ? "bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-500/30"
                : "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25",
            )}
            title={`${meetingCount} rendez-vous — voir la liste`}
          >
            {meetingCount}
          </button>
        ) : null}
        {blocked ? (
          <span
            className="max-w-[72px] truncate rounded bg-red-500/20 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-red-300"
            title={blocked.reason ? `Indisponible — ${blocked.reason}` : "Indisponible"}
          >
            {blocked.reason ? blocked.reason : "Off"}
          </span>
        ) : null}
      </div>
    </div>
  );
}

type ShowMoreProps = {
  count: number;
  events: unknown[];
};

export function CalendarShowMore({ count }: ShowMoreProps) {
  return (
    <button
      type="button"
      className="rbc-show-more-custom mt-0.5 w-full rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-left text-[10px] font-medium text-emerald-300 transition hover:bg-zinc-700/80"
    >
      +{count} RDV
    </button>
  );
}
