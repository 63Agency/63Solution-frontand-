import type { WhatsAppMessageStatus } from "./types";

/** Ordre de progression Meta (sent → delivered → read). */
const STATUS_RANK: Record<WhatsAppMessageStatus, number> = {
  failed: -1,
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

/** Garde le statut le plus avancé lors d'un merge poll (ne jamais rétrograder read → sent). */
export function mergeMessageStatus(
  current: WhatsAppMessageStatus,
  incoming: WhatsAppMessageStatus,
): WhatsAppMessageStatus {
  if (incoming === "failed") return "failed";
  if (current === "failed") {
    return incoming === "pending" ? "failed" : incoming;
  }
  return STATUS_RANK[incoming] >= STATUS_RANK[current] ? incoming : current;
}

export function isOutboundDeliveryStatus(status: WhatsAppMessageStatus): boolean {
  return status === "sent" || status === "delivered" || status === "read";
}
