import { DEV_WHATSAPP, mailtoLink, whatsappLink } from "../contact";

describe("contacto con el desarrollador", () => {
  it("el WhatsApp lleva el código de Perú y solo dígitos", () => {
    expect(DEV_WHATSAPP).toMatch(/^51\d{9}$/);
    expect(DEV_WHATSAPP.endsWith("937385728")).toBe(true);
  });

  it("arma los enlaces de correo y de WhatsApp con el texto codificado", () => {
    expect(mailtoLink("Sugerencia de EVA")).toBe("mailto:robert.vs@outlook.com?subject=Sugerencia%20de%20EVA");
    expect(whatsappLink("Hola, te escribo desde EVA")).toBe("https://wa.me/51937385728?text=Hola%2C%20te%20escribo%20desde%20EVA");
  });
});
