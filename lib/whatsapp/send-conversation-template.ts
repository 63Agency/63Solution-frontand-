import { sendBulkWhatsAppMessages } from "./backend-whatsapp";
import { templateBodyHasVariable1 } from "./whatsapp-templates";
import type { BulkWhatsAppSendResult } from "./types";

export type SendConversationTemplateOptions = {
  phoneNumber: string;
  templateName: string;
  templateLanguage?: string;
  /** Body du template (Meta) — sert à détecter si {{1}} est requis. */
  templateBody?: string;
  /** Remplace {{1}} — ignoré si le template n'a pas de variable. */
  variable1?: string;
};

/** Envoie un template WhatsApp approuvé à un contact (conversation > 24 h). */
export async function sendConversationWhatsAppTemplate(
  options: SendConversationTemplateOptions,
): Promise<BulkWhatsAppSendResult> {
  const phoneNumber = options.phoneNumber.trim();
  const templateName = options.templateName.trim();
  const templateLanguage = options.templateLanguage?.trim() || "fr";
  const needsVariable1 = templateBodyHasVariable1(options.templateBody);
  const variable1 = needsVariable1
    ? options.variable1?.trim() || "Client"
    : undefined;

  return sendBulkWhatsAppMessages({
    phoneNumbers: [phoneNumber],
    templateName,
    templateLanguage,
    ...(variable1
      ? { variable1, recipients: [{ phoneNumber, variable1 }] }
      : { components: [] }),
  });
}
