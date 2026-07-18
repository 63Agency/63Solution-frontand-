"use client";

import { cn } from "@/src/lib/utils";
import { avatarGradientClass } from "./whatsapp-utils";

type Props = {
  seed: string;
  label: string;
  size?: "sm" | "md";
  className?: string;
};

const sizeClass = {
  sm: "size-11 text-sm",
  md: "size-10 text-sm",
} as const;

export function ConversationAvatar({ seed, label, size = "sm", className }: Props) {
  const initial = label.charAt(0).toUpperCase() || "?";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-linear-to-br font-semibold text-white",
        avatarGradientClass(seed),
        sizeClass[size],
        className,
      )}
      aria-hidden
    >
      {initial}
    </div>
  );
}
