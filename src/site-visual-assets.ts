export type SiteVisualAssetDefinition = {
  key: string;
  label: string;
  section: string;
  description: string;
  alt: string;
  aspectWidth: number;
  aspectHeight: number;
  outputWidth: number;
  acceptedFormats?: string;
  usage?: string;
  placeholder?: boolean;
};

export const SITE_VISUAL_ASSETS: SiteVisualAssetDefinition[] = [
  { key: "/site/placeholder-produto-sem-foto.svg", label: "Produto sem foto oficial", section: "Imagens padrão", description: "Usada automaticamente quando um produto ainda não possui fotografia oficial.", alt: "Produto da Adoce ainda sem foto oficial", aspectWidth: 4, aspectHeight: 3, outputWidth: 1400, acceptedFormats: "JPG, PNG ou WebP", usage: "Produtos e serviços sem imagem cadastrada", placeholder: true },
  { key: "/site/placeholder-sabor-sem-foto.svg", label: "Sabor sem foto oficial", section: "Imagens padrão", description: "Usada automaticamente quando um sabor ainda não possui fotografia oficial.", alt: "Sabor da Adoce ainda sem foto oficial", aspectWidth: 1, aspectHeight: 1, outputWidth: 1200, acceptedFormats: "JPG, PNG ou WebP", usage: "Fatias e sabores sem imagem cadastrada", placeholder: true },
  { key: "/site/placeholder-torta-sem-foto.svg", label: "Torta sem foto oficial", section: "Imagens padrão", description: "Usada automaticamente quando uma torta inteira ainda não possui fotografia oficial.", alt: "Torta da Adoce ainda sem foto oficial", aspectWidth: 4, aspectHeight: 3, outputWidth: 1400, acceptedFormats: "JPG, PNG ou WebP", usage: "Tortas e produtos do segmento de tortas sem imagem", placeholder: true },
  { key: "/site/placeholder-campanha-sem-arte.svg", label: "Campanha sem arte", section: "Imagens padrão", description: "Usada quando uma campanha foi criada antes da arte oficial.", alt: "Campanha da Adoce com arte em preparação", aspectWidth: 4, aspectHeight: 5, outputWidth: 1200, acceptedFormats: "JPG, PNG ou WebP", usage: "Campanhas e comunicações ainda sem arte", placeholder: true },
  { key: "/site/logo.webp", label: "Logo oficial", section: "Marca", description: "Cabeçalhos, rodapés, operação e compartilhamentos.", alt: "Adoce Brigaderia", aspectWidth: 1, aspectHeight: 1, outputWidth: 900 },
  { key: "/site/hero-slice-real.webp", label: "Fatia principal da Home", section: "Página inicial", description: "Produto em destaque no primeiro bloco da página pública.", alt: "Fatia artesanal produzida pela Adoce", aspectWidth: 4, aspectHeight: 3, outputWidth: 1600 },
  { key: "/site/beth-fundadora.png", label: "Foto da Beth", section: "Página inicial", description: "História e origem da Adoce.", alt: "Beth, fundadora e confeiteira da Adoce", aspectWidth: 4, aspectHeight: 5, outputWidth: 1200 },
  { key: "/site/clube-cartao-destaque-v2.webp", label: "Cartão do Clube Adoce", section: "Página inicial", description: "Imagem principal do benefício do Clube.", alt: "Cartão do Clube Adoce", aspectWidth: 4, aspectHeight: 3, outputWidth: 1400 },
  { key: "/site/clube-aprovado-mobile-claro.png", label: "Clube Adoce — resumo claro", section: "Clube Adoce", description: "Apresentação compacta usada na Home e em celulares.", alt: "Apresentação do Clube Adoce", aspectWidth: 4, aspectHeight: 5, outputWidth: 1200 },
  { key: "/site/clube-aprovado-mobile-escuro.png", label: "Clube Adoce — celular escuro", section: "Clube Adoce", description: "Apresentação intermediária para tablets e celulares.", alt: "Apresentação do Clube Adoce", aspectWidth: 4, aspectHeight: 5, outputWidth: 1200 },
  { key: "/site/clube-aprovado-desktop.png", label: "Clube Adoce — computador", section: "Clube Adoce", description: "Apresentação completa em telas grandes.", alt: "Apresentação completa do Clube Adoce", aspectWidth: 16, aspectHeight: 9, outputWidth: 1800 },
  { key: "/site/clube-convite-pedido.webp", label: "Convite ao Clube após pedido", section: "Clube Adoce", description: "Imagem exibida quando um cliente ainda não participa do Clube.", alt: "Benefícios do Clube Adoce", aspectWidth: 4, aspectHeight: 3, outputWidth: 1200 },
  { key: "/site/pede-junto-pacotes.webp", label: "Pacotes do Pede Junto", section: "Pede Junto Adoce", description: "Imagem principal da compra compartilhada.", alt: "Pedidos separados do Pede Junto Adoce", aspectWidth: 4, aspectHeight: 3, outputWidth: 1400 },
  { key: "/site/pede-junto-trabalho.webp", label: "Pede Junto no trabalho", section: "Pede Junto Adoce", description: "Exemplo de grupo no trabalho.", alt: "Pede Junto Adoce no trabalho", aspectWidth: 4, aspectHeight: 3, outputWidth: 1200 },
  { key: "/site/pede-junto-condominio.webp", label: "Pede Junto no condomínio", section: "Pede Junto Adoce", description: "Exemplo de grupo em condomínio.", alt: "Pede Junto Adoce no condomínio", aspectWidth: 4, aspectHeight: 3, outputWidth: 1200 },
  { key: "/site/pede-junto-faculdade.webp", label: "Pede Junto na faculdade", section: "Pede Junto Adoce", description: "Exemplo de grupo na faculdade.", alt: "Pede Junto Adoce na faculdade", aspectWidth: 4, aspectHeight: 3, outputWidth: 1200 },
  { key: "/site/pede-junto-clinica.webp", label: "Pede Junto na clínica", section: "Pede Junto Adoce", description: "Exemplo de grupo em clínica.", alt: "Pede Junto Adoce na clínica", aspectWidth: 4, aspectHeight: 3, outputWidth: 1200 },
  { key: "/site/adoce-hoje-retirada-ilustracao.webp", label: "Ilustração da retirada", section: "Adoce Hoje", description: "Representa retirada na Adoce sem sugerir entrada no local.", alt: "Ilustração de retirada de pedido na Adoce", aspectWidth: 4, aspectHeight: 3, outputWidth: 1400 },
  { key: "/site/adoce-hoje-barraquinha-ilustracao.webp", label: "Ilustração da barraquinha", section: "Adoce Hoje", description: "Representa o Festival de Fatias na rua.", alt: "Ilustração da barraquinha de rua da Adoce", aspectWidth: 4, aspectHeight: 3, outputWidth: 1400 },
  { key: "/site/adoce-hoje-exemplo-desktop.png", label: "Exemplo do Adoce Hoje — computador", section: "Adoce Hoje", description: "Imagem ilustrativa usada na página inicial.", alt: "Exemplo ilustrativo da página Adoce Hoje", aspectWidth: 16, aspectHeight: 10, outputWidth: 1800 },
  { key: "/site/adoce-hoje-exemplo-mobile.png", label: "Exemplo do Adoce Hoje — celular", section: "Adoce Hoje", description: "Versão móvel do exemplo ilustrativo.", alt: "Exemplo ilustrativo da página Adoce Hoje no celular", aspectWidth: 9, aspectHeight: 16, outputWidth: 1000 },
  { key: "/site/politica-de-pedidos.jpeg", label: "Política de pedidos", section: "Informações comerciais", description: "Arte com regras de encomendas e atendimento.", alt: "Política de pedidos da Adoce Brigaderia", aspectWidth: 4, aspectHeight: 3, outputWidth: 1600 },
  { key: "/site/hero-cake.webp", label: "Fatia de apoio do Clube", section: "Clube Adoce", description: "Imagem histórica usada em telas de acesso e materiais.", alt: "Fatia artesanal da Adoce", aspectWidth: 4, aspectHeight: 3, outputWidth: 1400 },
  { key: "/adoce-hoje/sabores-hoje.webp", label: "Arte de sabores de hoje", section: "Adoce Hoje", description: "Exemplo visual da comunicação diária de sabores.", alt: "Sabores do Festival de Fatias", aspectWidth: 4, aspectHeight: 5, outputWidth: 1200 },
];

export const siteVisualAssetKeys = new Set(SITE_VISUAL_ASSETS.map((asset) => asset.key));

export function siteVisualAssetOutputHeight(asset: SiteVisualAssetDefinition) {
  return Math.round(asset.outputWidth * asset.aspectHeight / asset.aspectWidth);
}

export function siteVisualAssetSizeLabel(asset: SiteVisualAssetDefinition) {
  return `${asset.outputWidth} × ${siteVisualAssetOutputHeight(asset)} px`;
}

export function siteVisualAssetFormatLabel(asset: SiteVisualAssetDefinition) {
  return asset.acceptedFormats || "JPG, PNG ou WebP";
}

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
