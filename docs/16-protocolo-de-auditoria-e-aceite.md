---
title: Protocolo de auditoria e aceite
description: Evidências mínimas para código, interface, banco, integrações e publicação.
status: Norma oficial
---

# Protocolo de auditoria e aceite

## Princípio

Quantidade de testes não substitui cobertura do fluxo real. Uma entrega deve informar exatamente o que foi verificado, em qual ambiente e com qual resultado.

## Estados permitidos em um relatório

| Estado | Significado |
|---|---|
| Implementado | Código alterado, ainda sem validação suficiente |
| Automático aprovado | Testes, análise e build aprovados |
| Visual aprovado | Interface inspecionada nos tamanhos declarados |
| Funcional aprovado | A ação alterou o estado esperado e persistiu |
| Produção aprovada | Fluxo repetido no domínio oficial |
| Parcial | Uma parte funciona e outra permanece pendente |
| Bloqueado | Depende de acesso, credencial, configuração ou decisão |

É proibido usar “tudo certo”, “100% validado” ou equivalente quando houver fluxo não testado.

## Portão automático

Execute:

```bash
npm run release:check
```

O comando deve aprovar testes, verificação de tipos, documentação e build.

## Auditoria visual

Para cada superfície alterada:

1. confirmar URL e identidade da página;
2. confirmar que a tela não está vazia;
3. verificar ausência de sobreposição de erro do framework;
4. verificar erros relevantes no console;
5. capturar evidência visual;
6. executar pelo menos uma interação real;
7. repetir no celular;
8. incluir tablet quando a operação for afetada.

A conferência responsiva obrigatória cobre 320, 360, 375, 390, 412, 430, 768, 1024 e 1280 px. Uma tela não pode receber o estado **Visual aprovado** quando alguma dessas larguras aplicáveis não tiver sido verificada ou quando sua implementação depender de reduzir um layout de computador por media queries com `max-width`.

Inspecione: primeiro enquadramento, rolagem, menus, modais, foco, teclado, estados vazios, carregamento, erro, sucesso, conteúdo longo e barras fixas.

## Auditoria funcional

Cada ação deve confirmar:

- resposta visível ao usuário;
- persistência após recarregar;
- efeito correto no banco;
- ausência de duplicidade;
- permissão adequada;
- histórico ou auditoria quando exigidos;
- atualização dos números derivados;
- mensagem humana em falhas previsíveis.

## Banco e segurança

- Tabelas públicas com RLS habilitada.
- Políticas separadas para leitura pública e escrita administrativa.
- `UPDATE` com política de leitura correspondente e `WITH CHECK`.
- Funções privilegiadas com execução revogada de `PUBLIC` e concedida somente aos papéis necessários.
- Nenhuma chave de serviço no frontend.
- Uploads limitados por tipo, tamanho e pasta.

## Publicação

1. validar localmente;
2. usar prévia somente se necessário;
3. obter aprovação;
4. publicar uma vez;
5. conferir domínio oficial;
6. consultar erros;
7. registrar versão e evidências.

## Relatório obrigatório

O relatório final deve listar:

- mudanças;
- arquivos ou superfícies afetadas;
- comandos executados;
- fluxos interagidos;
- tamanhos de tela conferidos;
- resultado no domínio oficial;
- riscos e partes não testadas.
