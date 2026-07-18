"use client";

import {
  Copy,
  CornerUpLeft,
  Forward,
  Pin,
  Plus,
  Smile,
  Star,
  ThumbsDown,
  Trash2,
} from "lucide-react";

const WA = {
  panel: "#233138",
  text: "#e9edef",
  muted: "#8696a0",
  hover: "rgba(255,255,255,0.06)",
  border: "#3b4a54",
} as const;

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

export type MessageMenuAction =
  | "reply"
  | "copy"
  | "react"
  | "forward"
  | "pin"
  | "important"
  | "note"
  | "report"
  | "delete"
  | "reaction";

type Props = {
  x: number;
  y: number;
  onAction: (action: MessageMenuAction, reaction?: string) => void;
  onClose: () => void;
};

export function MessageContextMenu({ x, y, onAction, onClose }: Props) {
  // Keep menu inside viewport
  const left = Math.min(x, typeof window !== "undefined" ? window.innerWidth - 280 : x);
  const top = Math.min(y, typeof window !== "undefined" ? window.innerHeight - 420 : y);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default bg-transparent"
        aria-label="Fermer le menu"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        role="menu"
        className="fixed z-50 w-[260px] overflow-hidden rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.45)]"
        style={{
          left,
          top,
          backgroundColor: WA.panel,
          border: `1px solid ${WA.border}`,
        }}
      >
        {/* Reactions */}
        <div className="flex items-center justify-between gap-0.5 px-2 py-2">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="menuitem"
              className="flex size-9 items-center justify-center rounded-full text-[20px] transition-transform hover:scale-125 hover:bg-white/10"
              onClick={() => onAction("reaction", emoji)}
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-white/10"
            style={{ color: WA.muted }}
            aria-label="Plus de réactions"
            onClick={() => onAction("react")}
          >
            <Plus className="size-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="mx-2 h-px" style={{ backgroundColor: WA.border }} />

        <MenuItem icon={<CornerUpLeft className="size-[18px]" />} label="Répondre" onClick={() => onAction("reply")} />
        <MenuItem icon={<Copy className="size-[18px]" />} label="Copier" onClick={() => onAction("copy")} />
        <MenuItem icon={<Smile className="size-[18px]" />} label="Réagir" onClick={() => onAction("react")} />
        <MenuItem icon={<Forward className="size-[18px]" />} label="Transférer" onClick={() => onAction("forward")} />
        <MenuItem icon={<Pin className="size-[18px]" />} label="Épingler" onClick={() => onAction("pin")} />
        <MenuItem icon={<Star className="size-[18px]" />} label="Marquer comme important" onClick={() => onAction("important")} />
        <MenuItem icon={<Plus className="size-[18px]" />} label="Ajouter du texte à la note" onClick={() => onAction("note")} />

        <div className="mx-2 h-px" style={{ backgroundColor: WA.border }} />

        <MenuItem icon={<ThumbsDown className="size-[18px]" />} label="Signaler" onClick={() => onAction("report")} />
        <MenuItem
          icon={<Trash2 className="size-[18px]" />}
          label="Supprimer"
          onClick={() => onAction("delete")}
          danger
        />
      </div>
    </>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14.5px] transition-colors hover:bg-white/6"
      style={{ color: danger ? "#ea4335" : WA.text }}
    >
      <span style={{ color: danger ? "#ea4335" : WA.muted }}>{icon}</span>
      {label}
    </button>
  );
}
