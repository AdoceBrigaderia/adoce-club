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
// imagens). Só entram aqui imagens que algum componente do site realmente
// renderiza hoje -- confirmado em 03/11/2026 varrendo o código por cada
// arquivo. Página inicial, Informações comerciais e Pede Junto Adoce foram
// removidas inteiras: nenhuma das fotos daquelas seções aparecia em lugar
// nenhum (a Home não usa nenhuma foto mais, a página de política de
// pedidos é só texto, e o Pede Junto foi desativado -- migração
// 20261007034349_retire_pede_junto.sql -- e não tem mais rota no site).
export const SITE_VISUAL_ASSETS: SiteVisualAssetDefinition[] = [
  { key: "/site/logo.webp", label: "Logo oficial", section: "Marca", description: "Cabeçalhos, rodapés, operação e compartilhamentos.", alt: "Cantinho da Adoce", aspectWidth: 1, aspectHeight: 1, outputWidth: 900, fitMode: "contain" },
  { key: "/site/clube-convite-pedido.webp", label: "Convite ao Clube após pedido", section: "Clube Adoce", description: "Imagem exibida quando um cliente ainda não participa do Clube.", alt: "Benefícios do Clube Adoce", aspectWidth: 4, aspectHeight: 3, outputWidth: 1200, fitMode: "stretch" },
  { key: "/site/hero-cake.webp", label: "Fatia de apoio do Clube", section: "Clube Adoce", description: "Imagem de fundo nas telas de acesso e conta do Clube Adoce.", alt: "Fatia artesanal da Adoce", aspectWidth: 4, aspectHeight: 3, outputWidth: 1400, fitMode: "stretch" },
  { key: "/site/adoce-hoje-retirada-ilustracao.webp", label: "Ilustração da retirada", section: "Adoce Hoje", description: "Representa retirada na Adoce sem sugerir entrada no local.", alt: "Ilustração de retirada de pedido na Adoce", aspectWidth: 4, aspectHeight: 3, outputWidth: 1400, fitMode: "stretch" },
  { key: "/site/adoce-hoje-barraquinha-ilustracao.webp", label: "Ilustração do Cantinho da Adoce", section: "Adoce Hoje", description: "Representa o Festival de Fatias no Cantinho da Adoce.", alt: "Ilustração do Cantinho da Adoce", aspectWidth: 4, aspectHeight: 3, outputWidth: 1400, fitMode: "stretch" },
  { key: "/adoce-hoje/sabores-hoje.webp", label: "Arte de sabores de hoje", section: "Adoce Hoje", description: "Aparece quando um sabor ainda não tem foto própria cadastrada.", alt: "Sabores do Festival de Fatias", aspectWidth: 4, aspectHeight: 5, outputWidth: 1200, fitMode: "stretch" },
];

export type SiteVisualPageLink = { label: string; url: string };

const publicPage = (label: string, route = "/"): SiteVisualPageLink => ({
  label,
  url: `https://www.cantinhodaadoce.com.br${route}`,
});

export const SITE_VISUAL_PAGE_LINKS: Record<string, SiteVisualPageLink[]> = {
  "/site/logo.webp": [
    publicPage("Página inicial"),
    publicPage("Adoce Hoje", "/adoce-hoje"),
    publicPage("Clube Adoce", "/clube"),
    publicPage("Adoce Operação", "/operacao"),
  ],
  "/site/clube-convite-pedido.webp": [publicPage("Carrinho — após enviar um pedido", "/carrinho")],
  "/site/hero-cake.webp": [publicPage("Entrar no Clube Adoce", "/entrar")],
  "/site/adoce-hoje-retirada-ilustracao.webp": [publicPage("Adoce Hoje", "/adoce-hoje")],
  "/site/adoce-hoje-barraquinha-ilustracao.webp": [publicPage("Adoce Hoje", "/adoce-hoje")],
  "/adoce-hoje/sabores-hoje.webp": [publicPage("Adoce Hoje", "/adoce-hoje")],
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
