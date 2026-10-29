# Plano de reestruturação do Portal Adoce

Branch de trabalho criada a partir da fonte oficial consolidada em 25/07/2026.

## Objetivos

1. Reorganizar a experiência operacional e do cliente com abordagem mobile-first.
2. Implantar gestão centralizada de todas as imagens do site.
3. Consolidar lojas, caixas, equipe, permissões, produtos, estoque, CRM e relatórios.
4. Manter produção intacta até homologação e aprovação.

## Gestão centralizada de imagens

A nova área **Biblioteca de imagens** deverá:

- listar todas as imagens utilizadas pelo site, sem exceção;
- identificar página, seção e finalidade de cada imagem;
- informar proporção, largura e altura recomendadas;
- permitir upload, arrastar arquivo e colar imagem da área de transferência;
- exibir prévia antes de salvar;
- permitir substituir, restaurar padrão e consultar histórico;
- aceitar imagens gerais, banners, logos, ícones, produtos, sabores, campanhas e placeholders;
- fornecer imagens padronizadas para produtos sem fotografia oficial;
- impedir que um produto novo receba uma imagem aleatória ou sem origem identificável;
- registrar autor, data e origem de cada alteração;
- funcionar adequadamente em celular, tablet e desktop.

## Regras de segurança

- Nenhuma alteração será publicada diretamente em produção.
- Mudanças de banco serão executadas primeiro no Supabase de homologação.
- O site de produção permanecerá preservado até aprovação expressa.
