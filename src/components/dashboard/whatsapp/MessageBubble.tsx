"use client";

import { Check, CheckCheck } from "lucide-react";
import type { WhatsAppMessage } from "@/lib/whatsapp/types";
import { formatChatTime } from "./whatsapp-utils";

type Props = {
  message: WhatsAppMessage;
};

function StatusIcon({ status }: { status: WhatsAppMessage["status"] }) {
  if (status === "failed") {
    return <span className="text-[10px] text-red-300">!</span>;
  }
  if (status === "read") {
    return <CheckCheck className="size-3.5 text-sky-300" aria-hidden />;
  }
  if (status === "delivered") {
    return <CheckCheck className="size-3.5 text-zinc-400" aria-hidden />;
  }
  return <Check className="size-3.5 text-zinc-500" aria-hidden />;
}

export function MessageBubble({ message }: Props) {
  const outbound = message.direction === "outbound";
  const time = formatChatTime(message.sentAt ?? message.createdAt);

  return (
    <div
      className={`flex ${outbound ? "justify-end" : "justify-start"}`}
      data-message-id={message.id}
    >
      <div
        className={`max-w-[min(85%,420px)] rounded-lg px-3 py-2 shadow-sm ${
          outbound
            ? "rounded-br-none bg-emerald-800 text-emerald-50"
            : "rounded-bl-none bg-zinc-800 text-zinc-100"
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">
          {message.body || (message.type !== "text" ? `[${message.type}]` : "")}
        </p>
        <div
          className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${
            outbound ? "text-emerald-200/80" : "text-zinc-400"
          }`}
        >
          <span>{time}</span>
          {outbound ? <StatusIcon status={message.status} /> : null}
        </div>
      </div>
    </div>
  );
}
