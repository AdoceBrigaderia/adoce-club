export type SiteVisualAssetDefinition = {
  key: string;
  label: string;
  section: string;
  description: string;
  alt: string;
  aspectWidth: number;
  aspectHeight: number;
  outputWidth: number;
  fitMode: "stretch" | "cover" | "contain";
};

// Fonte única das fotos institucionais editáveis pela Operação (central de
// imagens). Só entram aqui imagens que foram CONFIRMADAS ao vivo (DOM da
// página em produção, não só grep de código) como realmente exibidas em
// algum lugar de verdade -- revisão de 03/11/2026, segunda passada, mais
// rigorosa que a primeira.
//
// Removidas nesta passada, mesmo aparecendo em algum arquivo .tsx:
// - /site/hero-cake.webp: a classe CSS que usa essa imagem
//   (.access-auth-copy) não existe em nenhum componente -- confirmado que
//   o elemento não existe no DOM de /entrar em produção. CSS morto.
// - /adoce-hoje/sabores-hoje.webp: só aparece quando um sabor ativo não tem
//   foto própria -- hoje nenhum sabor ativo está nessa situação, então não
//   aparece em lugar nenhum agora. Fica só como fallback no código.
//
// /site/logo.webp foi removido e depois devolvido: o cabeçalho do site
// público usa /brand-2026/logo-*.png (essa imagem NÃO controla o
// cabeçalho), mas ela é a logo que sai de verdade no recibo térmico
// impresso no caixa e no PDF de orçamento de encomenda enviado ao cliente
// -- sem essa entrada o proprietário perderia a única forma de trocar essa
// logo impressa. A descrição/seção abaixo foram corrigidas para dizer isso
// com precisão, em vez de prometer que controla o site.
export const SITE_VISUAL_ASSETS: SiteVisualAssetDefinition[] = [
  { key: "/site/logo.webp", label: "Logo dos impressos", section: "Documentos impressos", description: "Logo que sai no recibo térmico do caixa e no PDF de orçamento de encomenda. Não é a logo do cabeçalho do site -- essa vem de outro arquivo.", alt: "Cantinho da Adoce", aspectWidth: 1, aspectHeight: 1, outputWidth: 900, fitMode: "contain" },
  { key: "/site/clube-convite-pedido.webp", label: "Convite ao Clube após pedido", section: "Clube Adoce", description: "Imagem exibida quando um cliente ainda não participa do Clube.", alt: "Benefícios do Clube Adoce", aspectWidth: 4, aspectHeight: 3, outputWidth: 1200, fitMode: "stretch" },
  { key: "/site/adoce-hoje-retirada-ilustracao.webp", label: "Ilustração da retirada", section: "Adoce Hoje", description: "Representa retirada na Adoce sem sugerir entrada no local.", alt: "Ilustração de retirada de pedido na Adoce", aspectWidth: 4, aspectHeight: 3, outputWidth: 1400, fitMode: "stretch" },
  { key: "/site/adoce-hoje-barraquinha-ilustracao.webp", label: "Ilustração do Cantinho da Adoce", section: "Adoce Hoje", description: "Representa o Festival de Fatias no Cantinho da Adoce.", alt: "Ilustração do Cantinho da Adoce", aspectWidth: 4, aspectHeight: 3, outputWidth: 1400, fitMode: "stretch" },
];

export type SiteVisualPageLink = { label: string; url: string };

const publicPage = (label: string, route = "/"): SiteVisualPageLink => ({
  label,
  url: `https://www.cantinhodaadoce.com.br${route}`,
});

export const SITE_VISUAL_PAGE_LINKS: Record<string, SiteVisualPageLink[]> = {
  "/site/logo.webp": [publicPage("Operação — Pedidos/Encomendas (recibo e orçamento impressos)", "/operacao/pedidos")],
  "/site/clube-convite-pedido.webp": [publicPage("Carrinho — após enviar um pedido", "/carrinho")],
  "/site/adoce-hoje-retirada-ilustracao.webp": [publicPage("Carrinho", "/carrinho")],
  "/site/adoce-hoje-barraquinha-ilustracao.webp": [publicPage("Carrinho", "/carrinho")],
};

export const siteVisualAssetKeys = new Set(SITE_VISUAL_ASSETS.map((asset) => asset.key));

export function visualAssetPath(value: string) {
  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.pathname === "/.netlify/images") {
      return parsed.searchParams.get("url") || parsed.pathname;
    }
    return parsed.pathname;
  } catch {
    return value;
  }
}
