/** Cómo escribirle directamente al desarrollador (pantalla de sugerencias). */
export const DEV_EMAIL = "robert.vs@outlook.com";
/** Número de WhatsApp con código de país (Perú, +51), sin signos ni espacios. */
export const DEV_WHATSAPP = "51937385728";

export const mailtoLink = (subject: string): string => `mailto:${DEV_EMAIL}?subject=${encodeURIComponent(subject)}`;
export const whatsappLink = (text: string): string => `https://wa.me/${DEV_WHATSAPP}?text=${encodeURIComponent(text)}`;
