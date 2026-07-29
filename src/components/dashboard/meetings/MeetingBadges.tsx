"use client";

import { cn } from "@/src/lib/utils";
import {
  MEETING_REMINDER_OFFSET_SHORT,
  MEETING_STATUS_COLORS,
  MEETING_STATUS_LABELS,
  type MeetingReminderDeliveryStatus,
  type MeetingReminderOffset,
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

const STATUS_STYLES: Record<
  MeetingReminderDeliveryStatus,
  { className: string; label: string }
> = {
  sent: { className: "bg-emerald-500/20 text-emerald-300", label: "envoyé" },
  pending: { className: "bg-zinc-800 text-zinc-400", label: "prévu" },
  skipped: { className: "bg-zinc-800/60 text-zinc-600", label: "désactivé" },
  failed: { className: "bg-red-500/15 text-red-300", label: "échec" },
};

export function ReminderOffsetBadge({
  offset,
  enabled,
  status,
}: {
  offset: MeetingReminderOffset;
  enabled: boolean;
  status: MeetingReminderDeliveryStatus;
}) {
  const effective: MeetingReminderDeliveryStatus = enabled
    ? status
    : "skipped";
  const style = STATUS_STYLES[effective];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        style.className,
      )}
      title={`${MEETING_REMINDER_OFFSET_SHORT[offset]} — ${style.label}`}
    >
      {MEETING_REMINDER_OFFSET_SHORT[offset]}
      <span className="font-normal normal-case tracking-normal opacity-80">
        · {style.label}
      </span>
    </span>
  );
}
