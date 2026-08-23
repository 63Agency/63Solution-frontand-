/** Nom du template Meta « bonjour » — surcharge via NEXT_PUBLIC_WHATSAPP_GREETING_TEMPLATE. */
export function getGreetingTemplateName(): string {
  const fromEnv = process.env.NEXT_PUBLIC_WHATSAPP_GREETING_TEMPLATE?.trim();
  return fromEnv || "bonjour";
}

export const GREETING_TEMPLATE_LANGUAGE = "fr";
