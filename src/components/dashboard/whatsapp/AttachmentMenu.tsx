"use client";

import {
  Calendar,
  Contact,
  FileText,
  Image as ImageIcon,
  Mic,
  BarChart3,
} from "lucide-react";

const WA = {
  panel: "#233138",
  text: "#e9edef",
  border: "rgba(134,150,160,0.2)",
} as const;

export type AttachmentMenuAction =
  | "document"
  | "media"
  | "audio"
  | "contact"
  | "poll"
  | "event";

type Props = {
  onSelect: (action: AttachmentMenuAction) => void;
};

const ITEMS: {
  action: AttachmentMenuAction;
  label: string;
  icon: React.ReactNode;
  bg: string;
}[] = [
  {
    action: "document",
    label: "Document",
    icon: <FileText className="size-[18px] text-white" strokeWidth={2} />,
    bg: "#7f66ff",
  },
  {
    action: "media",
    label: "Photos et vidéos",
    icon: <ImageIcon className="size-[18px] text-white" strokeWidth={2} />,
    bg: "#007bfc",
  },
  {
    action: "audio",
    label: "Audio",
    icon: <Mic className="size-[18px] text-white" strokeWidth={2} />,
    bg: "#ff339c",
  },
  {
    action: "contact",
    label: "Contact",
    icon: <Contact className="size-[18px] text-white" strokeWidth={2} />,
    bg: "#009de2",
  },
  {
    action: "poll",
    label: "Sondage",
    icon: <BarChart3 className="size-[18px] text-white" strokeWidth={2} />,
    bg: "#ffbc38",
  },
  {
    action: "event",
    label: "Événement",
    icon: <Calendar className="size-[18px] text-white" strokeWidth={2} />,
    bg: "#ff6663",
  },
];

export function AttachmentMenu({ onSelect }: Props) {
  return (
    <div
      className="absolute bottom-[calc(100%-4px)] left-3 z-30 w-[240px] overflow-hidden rounded-2xl py-2 shadow-[0_4px_24px_rgba(0,0,0,0.45)]"
      style={{ backgroundColor: WA.panel, border: `1px solid ${WA.border}` }}
      role="menu"
    >
      {ITEMS.map((item) => (
        <button
          key={item.action}
          type="button"
          role="menuitem"
          onClick={() => onSelect(item.action)}
          className="flex w-full items-center gap-3.5 px-4 py-2.5 text-left transition-colors hover:bg-white/5"
        >
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: item.bg }}
          >
            {item.icon}
          </span>
          <span className="text-[15px] leading-tight" style={{ color: WA.text }}>
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
}
