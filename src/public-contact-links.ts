const whatsappMessage = encodeURIComponent(
  "Olá! Vim pelo site da Adoce e gostaria de atendimento.",
);

export const publicContactLinks = {
  facebook: "https://www.facebook.com/adocebrigaderia",
  instagram: "https://www.instagram.com/_adocebrigaderia_/",
  whatsappPrimary: `https://wa.me/5585982156026?text=${whatsappMessage}`,
  whatsappSecondary: `https://wa.me/5585981994370?text=${whatsappMessage}`,
} as const;

export function shouldShowPublicContactDock(hostname: string, hash: string) {
  const host = hostname.toLowerCase();
  const normalizedHash = hash.toLowerCase();

  if (host.startsWith("operacao.")) return false;

  return ![
    "#operacao",
    "#operacao-demo",
    "#membro-demo",
    "#restauracao-demo",
    "#campanha-",
    "#lancamento-",
    "#entrar",
    "#cadastro",
    "#minha-conta",
    "#acesso-direto",
    "#fale-com-a-adoce",
  ].some((prefix) => normalizedHash.startsWith(prefix));
}
