import { sendBulkWhatsAppMessages } from "./backend-whatsapp";
import type { BulkWhatsAppSendResult } from "./types";

export type SendConversationTemplateOptions = {
  phoneNumber: string;
  templateName: string;
  templateLanguage?: string;
  /** Remplace {{1}} dans le body du template. */
  variable1?: string;
};

/** Envoie un template WhatsApp approuvé à un contact (conversation > 24 h). */
export async function sendConversationWhatsAppTemplate(
  options: SendConversationTemplateOptions,
): Promise<BulkWhatsAppSendResult> {
  const phoneNumber = options.phoneNumber.trim();
  const templateName = options.templateName.trim();
  const templateLanguage = options.templateLanguage?.trim() || "fr";
  const variable1 = options.variable1?.trim() || "Client";

  return sendBulkWhatsAppMessages({
    phoneNumbers: [phoneNumber],
    templateName,
    templateLanguage,
    variable1,
    recipients: [{ phoneNumber, variable1 }],
  });
}
