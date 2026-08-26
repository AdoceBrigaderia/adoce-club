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

export const SITE_VISUAL_ASSETS: SiteVisualAssetDefinition[] = [
  { key: "/site/logo.webp", label: "Logo oficial", section: "Marca", description: "Cabeçalhos, rodapés, operação e compartilhamentos.", alt: "Adoce Brigaderia", aspectWidth: 1, aspectHeight: 1, outputWidth: 900, fitMode: "contain" },
  { key: "/site/trufado-de-ninho-home-20260803.png", label: "Fatia principal da Home", section: "Página inicial", description: "Produto em destaque no primeiro bloco da página pública.", alt: "Fatias Trufado de Ninho preparadas pela Adoce", aspectWidth: 1, aspectHeight: 1, outputWidth: 1400, fitMode: "cover" },
  { key: "/site/beth-fundadora.png", label: "Foto da Beth", section: "Página inicial", description: "História e origem da Adoce.", alt: "Beth, fundadora e confeiteira da Adoce", aspectWidth: 4, aspectHeight: 5, outputWidth: 1200, fitMode: "stretch" },
  { key: "/site/clube-cartao-destaque-v2.webp", label: "Cartão do Clube Adoce", section: "Página inicial", description: "Imagem principal do benefício do Clube.", alt: "Cartão do Clube Adoce", aspectWidth: 4, aspectHeight: 3, outputWidth: 1400, fitMode: "stretch" },
  { key: "/site/clube-aprovado-mobile-claro.png", label: "Clube Adoce — resumo claro", section: "Clube Adoce", description: "Apresentação compacta usada na Home e em celulares.", alt: "Apresentação do Clube Adoce", aspectWidth: 4, aspectHeight: 5, outputWidth: 1200, fitMode: "stretch" },
  { key: "/site/clube-aprovado-mobile-escuro.png", label: "Clube Adoce — celular escuro", section: "Clube Adoce", description: "Apresentação intermediária para tablets e celulares.", alt: "Apresentação do Clube Adoce", aspectWidth: 4, aspectHeight: 5, outputWidth: 1200, fitMode: "stretch" },
  { key: "/site/clube-aprovado-desktop.png", label: "Clube Adoce — computador", section: "Clube Adoce", description: "Apresentação completa em telas grandes.", alt: "Apresentação completa do Clube Adoce", aspectWidth: 16, aspectHeight: 9, outputWidth: 1800, fitMode: "stretch" },
  { key: "/site/clube-convite-pedido.webp", label: "Convite ao Clube após pedido", section: "Clube Adoce", description: "Imagem exibida quando um cliente ainda não participa do Clube.", alt: "Benefícios do Clube Adoce", aspectWidth: 4, aspectHeight: 3, outputWidth: 1200, fitMode: "stretch" },
  { key: "/site/pede-junto-pacotes.webp", label: "Pacotes do Pede Junto", section: "Pede Junto Adoce", description: "Imagem principal da compra compartilhada.", alt: "Pedidos separados do Pede Junto Adoce", aspectWidth: 4, aspectHeight: 3, outputWidth: 1400, fitMode: "stretch" },
  { key: "/site/pede-junto-trabalho.webp", label: "Pede Junto no trabalho", section: "Pede Junto Adoce", description: "Exemplo de grupo no trabalho.", alt: "Pede Junto Adoce no trabalho", aspectWidth: 4, aspectHeight: 3, outputWidth: 1200, fitMode: "stretch" },
  { key: "/site/pede-junto-condominio.webp", label: "Pede Junto no condomínio", section: "Pede Junto Adoce", description: "Exemplo de grupo em condomínio.", alt: "Pede Junto Adoce no condomínio", aspectWidth: 4, aspectHeight: 3, outputWidth: 1200, fitMode: "stretch" },
  { key: "/site/pede-junto-faculdade.webp", label: "Pede Junto na faculdade", section: "Pede Junto Adoce", description: "Exemplo de grupo na faculdade.", alt: "Pede Junto Adoce na faculdade", aspectWidth: 4, aspectHeight: 3, outputWidth: 1200, fitMode: "stretch" },
  { key: "/site/pede-junto-clinica.webp", label: "Pede Junto na clínica", section: "Pede Junto Adoce", description: "Exemplo de grupo em clínica.", alt: "Pede Junto Adoce na clínica", aspectWidth: 4, aspectHeight: 3, outputWidth: 1200, fitMode: "stretch" },
  { key: "/site/adoce-hoje-retirada-ilustracao.webp", label: "Ilustração da retirada", section: "Adoce Hoje", description: "Representa retirada na Adoce sem sugerir entrada no local.", alt: "Ilustração de retirada de pedido na Adoce", aspectWidth: 4, aspectHeight: 3, outputWidth: 1400, fitMode: "stretch" },
  { key: "/site/adoce-hoje-barraquinha-ilustracao.webp", label: "Ilustração do Cantinho da Adoce", section: "Adoce Hoje", description: "Representa o Festival de Fatias no Cantinho da Adoce.", alt: "Ilustração do Cantinho da Adoce", aspectWidth: 4, aspectHeight: 3, outputWidth: 1400, fitMode: "stretch" },
  { key: "/site/adoce-hoje-exemplo-desktop.png", label: "Exemplo do Adoce Hoje — computador", section: "Adoce Hoje", description: "Imagem ilustrativa usada na página inicial.", alt: "Exemplo ilustrativo da página Adoce Hoje", aspectWidth: 16, aspectHeight: 10, outputWidth: 1800, fitMode: "stretch" },
  { key: "/site/adoce-hoje-exemplo-mobile.png", label: "Exemplo do Adoce Hoje — celular", section: "Adoce Hoje", description: "Versão móvel do exemplo ilustrativo.", alt: "Exemplo ilustrativo da página Adoce Hoje no celular", aspectWidth: 9, aspectHeight: 16, outputWidth: 1000, fitMode: "stretch" },
  { key: "/site/politica-de-pedidos.jpeg", label: "Política de pedidos", section: "Informações comerciais", description: "Arte com regras de encomendas e atendimento.", alt: "Política de pedidos da Adoce Brigaderia", aspectWidth: 4, aspectHeight: 3, outputWidth: 1600, fitMode: "stretch" },
  { key: "/site/hero-cake.webp", label: "Fatia de apoio do Clube", section: "Clube Adoce", description: "Imagem histórica usada em telas de acesso e materiais.", alt: "Fatia artesanal da Adoce", aspectWidth: 4, aspectHeight: 3, outputWidth: 1400, fitMode: "stretch" },
  { key: "/adoce-hoje/sabores-hoje.webp", label: "Arte de sabores de hoje", section: "Adoce Hoje", description: "Exemplo visual da comunicação diária de sabores.", alt: "Sabores do Festival de Fatias", aspectWidth: 4, aspectHeight: 5, outputWidth: 1200, fitMode: "stretch" },
];

export type SiteVisualPageLink = { label: string; url: string };

const publicPage = (label: string, route = ""): SiteVisualPageLink => ({
  label,
  url: `https://www.adocebrigaderia.com.br/${route}`,
});

export const SITE_VISUAL_PAGE_LINKS: Record<string, SiteVisualPageLink[]> = {
  "/site/logo.webp": [
    publicPage("Página inicial"),
    publicPage("Adoce Hoje", "#adoce-hoje"),
    publicPage("Clube Adoce", "#clube"),
    publicPage("Adoce Operação", "#operacao"),
  ],
  "/site/trufado-de-ninho-home-20260803.png": [publicPage("Página inicial")],
  "/site/beth-fundadora.png": [publicPage("Página inicial")],
  "/site/clube-cartao-destaque-v2.webp": [publicPage("Página inicial")],
  "/site/clube-aprovado-mobile-claro.png": [publicPage("Página inicial"), publicPage("Clube Adoce", "#clube")],
  "/site/clube-aprovado-mobile-escuro.png": [publicPage("Clube Adoce", "#clube")],
  "/site/clube-aprovado-desktop.png": [publicPage("Clube Adoce", "#clube")],
  "/site/clube-convite-pedido.webp": [publicPage("Adoce Hoje — após enviar um pedido", "#adoce-hoje")],
  "/site/pede-junto-pacotes.webp": [publicPage("Página inicial"), publicPage("Pede Junto Adoce", "#pede-junto")],
  "/site/pede-junto-trabalho.webp": [publicPage("Pede Junto Adoce", "#pede-junto")],
  "/site/pede-junto-condominio.webp": [publicPage("Pede Junto Adoce", "#pede-junto")],
  "/site/pede-junto-faculdade.webp": [publicPage("Pede Junto Adoce", "#pede-junto")],
  "/site/pede-junto-clinica.webp": [publicPage("Pede Junto Adoce", "#pede-junto")],
  "/site/adoce-hoje-retirada-ilustracao.webp": [publicPage("Adoce Hoje", "#adoce-hoje")],
  "/site/adoce-hoje-barraquinha-ilustracao.webp": [publicPage("Adoce Hoje", "#adoce-hoje")],
  "/site/adoce-hoje-exemplo-desktop.png": [publicPage("Página inicial")],
  "/site/adoce-hoje-exemplo-mobile.png": [publicPage("Página inicial")],
  "/site/politica-de-pedidos.jpeg": [publicPage("Política de pedidos", "#politica-de-pedidos")],
  "/site/hero-cake.webp": [publicPage("Entrar no Clube Adoce", "#entrar")],
  "/adoce-hoje/sabores-hoje.webp": [publicPage("Adoce Hoje", "#adoce-hoje")],
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
