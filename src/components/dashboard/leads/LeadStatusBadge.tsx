import { leadStatusBadgeClass } from "@/lib/leads/lead-status";
import { cn } from "@/src/lib/utils";

type Props = {
  status: string;
};

export function LeadStatusBadge({ status }: Props) {
  const label = status.trim() || "unknown";

  return (
    <span
      className={cn(
        "inline-flex max-w-[12rem] items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        leadStatusBadgeClass(label),
      )}
      title={label}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}
