"use client";

import { Check, CheckCheck } from "lucide-react";
import type { WhatsAppMessage } from "@/lib/whatsapp/types";
import { cn } from "@/src/lib/utils";
import { formatChatTime } from "./whatsapp-utils";

type Props = {
  message: WhatsAppMessage;
};

function StatusIcon({ status }: { status: WhatsAppMessage["status"] }) {
  if (status === "failed") {
    return <span className="text-[10px] font-bold text-red-300">!</span>;
  }
  if (status === "read") {
    return <CheckCheck className="size-3.5 text-sky-300" aria-hidden />;
  }
  if (status === "delivered") {
    return <CheckCheck className="size-3.5 text-emerald-200/70" aria-hidden />;
  }
  return <Check className="size-3.5 text-emerald-200/50" aria-hidden />;
}

export function MessageBubble({ message }: Props) {
  const outbound = message.direction === "outbound";
  const time = formatChatTime(message.sentAt ?? message.createdAt);
  const body =
    message.body || (message.type !== "text" ? `[${message.type}]` : "");

  return (
    <div
      className={cn("flex", outbound ? "justify-end" : "justify-start")}
      data-message-id={message.id}
    >
      <div
        className={cn(
          "relative max-w-[min(88%,440px)] px-3 py-2 shadow-md",
          outbound
            ? "rounded-2xl rounded-br-sm bg-[#005c4b] text-[#e9edef]"
            : "rounded-2xl rounded-bl-sm bg-[#202c33] text-[#e9edef]",
        )}
      >
        <p className="whitespace-pre-wrap break-words text-[14.5px] leading-relaxed">
          {body}
        </p>
        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[11px]",
            outbound ? "text-emerald-100/75" : "text-zinc-400",
          )}
        >
          <span>{time}</span>
          {outbound ? <StatusIcon status={message.status} /> : null}
        </div>
      </div>
    </div>
  );
}
