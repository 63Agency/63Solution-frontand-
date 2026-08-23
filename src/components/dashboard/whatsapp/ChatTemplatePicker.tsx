"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, SendHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { getStoredAccessToken } from "@/lib/auth/backend-login";
import { sendConversationWhatsAppTemplate } from "@/lib/whatsapp/send-conversation-template";
import {
  formatWhatsAppSendError,
  isWhatsAppWindowClosedError,
  WINDOW_CLOSED_TOAST,
} from "@/lib/whatsapp/whatsapp-send-errors";
import { cn } from "@/src/lib/utils";
import { conversationDisplayName } from "./whatsapp-utils";

type TemplateRow = {
  id: string;
  name: string;
  body?: string;
};

type Props = {
  open: boolean;
  phoneNumber: string;
  contactName?: string;
  onClose: () => void;
  onSent?: () => void;
};

export function ChatTemplatePicker({
  open,
  phoneNumber,
  contactName,
  onClose,
  onSent,
}: Props) {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const variable1 =
    conversationDisplayName(contactName, phoneNumber) || "Client";

  const preview = useMemo(() => {
    if (!selected?.body) return "";
    return selected.body.replace(/\{\{1\}\}/g, variable1);
  }, [selected?.body, variable1]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setSelectedId("");
    void (async () => {
      try {
        const token = getStoredAccessToken();
        const res = await fetch("/api/whatsapp/templates", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = (await res.json().catch(() => null)) as {
          templates?: TemplateRow[];
          message?: string;
        } | null;
        if (!res.ok) {
          throw new Error(formatWhatsAppSendError(data?.message ?? `Erreur ${res.status}`));
        }
        const list = Array.isArray(data?.templates) ? data!.templates! : [];
        if (!cancelled) {
          setTemplates(list);
          if (list.length === 1) setSelectedId(list[0].id);
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Impossible de charger les templates.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sending, onClose]);

  const handleSend = async () => {
    if (!selected) {
      toast.error("Sélectionnez un template WhatsApp.");
      return;
    }
    setSending(true);
    try {
      const res = await sendConversationWhatsAppTemplate({
        phoneNumber,
        templateName: selected.name,
        templateLanguage: "fr",
        variable1,
      });
      if (res.failed > 0) {
        const firstErr = res.results.find((r) => !r.success)?.error ?? "";
        const msg = formatWhatsAppSendError(firstErr);
        if (isWhatsAppWindowClosedError(msg)) {
          toast.error(WINDOW_CLOSED_TOAST);
        } else {
          toast.error(msg || "Échec de l'envoi du template.");
        }
        return;
      }
      toast.success("Template envoyé.");
      onSent?.();
      onClose();
    } catch (e) {
      const msg = formatWhatsAppSendError(
        e instanceof Error ? e.message : "Envoi impossible.",
      );
      if (isWhatsAppWindowClosedError(msg)) {
        toast.error(WINDOW_CLOSED_TOAST);
      } else {
        toast.error(msg);
      }
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal
      aria-label="Envoyer un template"
      onClick={() => {
        if (!sending) onClose();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl shadow-xl"
        style={{ backgroundColor: "#202c33" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "rgba(134,150,160,0.2)" }}
        >
          <h2 className="text-[16px] font-medium" style={{ color: "#e9edef" }}>
            Envoyer un template
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="flex size-9 items-center justify-center rounded-full hover:bg-white/5 disabled:opacity-40"
            style={{ color: "#aebac1" }}
            aria-label="Fermer"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <p className="text-[13px]" style={{ color: "#8696a0" }}>
            À{" "}
            <span style={{ color: "#e9edef" }}>
              {conversationDisplayName(contactName, phoneNumber)}
            </span>
          </p>

          <div>
            <label
              htmlFor="chat-template-select"
              className="mb-1.5 block text-[12px] font-medium"
              style={{ color: "#8696a0" }}
            >
              Template approuvé
            </label>
            <select
              id="chat-template-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={loading || sending || templates.length === 0}
              className="w-full rounded-lg border-0 px-3 py-2.5 text-[14px] outline-none"
              style={{ backgroundColor: "#2a3942", color: "#e9edef" }}
            >
              <option value="">
                {loading ? "Chargement…" : "Choisir un template"}
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {preview ? (
            <div
              className="rounded-lg px-3 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap"
              style={{ backgroundColor: "#2a3942", color: "#e9edef" }}
            >
              {preview}
            </div>
          ) : null}

          {!loading && templates.length === 0 ? (
            <p className="text-[13px]" style={{ color: "#8696a0" }}>
              Aucun template disponible. Vérifiez la configuration Meta côté serveur.
            </p>
          ) : null}
        </div>

        <div
          className="flex justify-end gap-2 border-t px-4 py-3"
          style={{ borderColor: "rgba(134,150,160,0.2)" }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-lg px-4 py-2 text-[14px] hover:bg-white/5 disabled:opacity-40"
            style={{ color: "#aebac1" }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !selected}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[14px] font-medium text-[#111b21] disabled:opacity-50",
            )}
            style={{ backgroundColor: "#00a884" }}
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <SendHorizontal className="size-4" aria-hidden />
            )}
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
