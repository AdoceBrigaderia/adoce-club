const whatsappMessage = encodeURIComponent(
  "Olá! Vim pelo site da Adoce e gostaria de atendimento.",
);

export const publicContactLinks = {
  facebook: "https://www.facebook.com/adocebrigaderia",
  instagram: "https://www.instagram.com/_adocebrigaderia_/",
  whatsappPrimary: `https://wa.me/5585982156026?text=${whatsappMessage}`,
  whatsappSecondary: `https://wa.me/5585981994370?text=${whatsappMessage}`,
} as const;

export function shouldShowPublicContactDock(hostname: string, path: string) {
  const host = hostname.toLowerCase();
  const normalizedPath = path.toLowerCase();

  if (host.startsWith("operacao.")) return false;

  return ![
    "/operacao",
    "/clube",
    "/fale-com-a-adoce",
  ].some((prefix) => normalizedPath.startsWith(prefix));
}
