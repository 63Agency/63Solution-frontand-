"use client";

import { cn } from "@/src/lib/utils";
import {
  MEETING_STATUS_COLORS,
  MEETING_STATUS_LABELS,
  type MeetingStatus,
} from "@/lib/meetings/types";

export function MeetingStatusBadge({
  status,
  className,
}: {
  status: MeetingStatus;
  className?: string;
}) {
  const colors = MEETING_STATUS_COLORS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        colors.bg,
        colors.text,
        colors.border,
        className,
      )}
    >
      {MEETING_STATUS_LABELS[status]}
    </span>
  );
}

export function ReminderBadge({
  label,
  sent,
}: {
  label: string;
  sent: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        sent
          ? "bg-emerald-500/20 text-emerald-300"
          : "bg-zinc-800 text-zinc-500",
      )}
      title={sent ? `${label} envoyé` : `${label} non envoyé`}
    >
      {label}
    </span>
  );
}
