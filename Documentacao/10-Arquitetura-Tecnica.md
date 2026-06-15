# Arquitetura Técnica

React + TypeScript + Vite compõem o PWA. React Router trata rotas e Zustand persiste o protótipo no `localStorage` do aparelho para demonstração. Supabase será a camada de autenticação, PostgreSQL, RLS e funções transacionais.

## Limite atual

O `localStorage` não sincroniza aparelhos, não oferece autenticação e não substitui um banco. Ele existe apenas para a primeira demonstração não perder caixa, vendas e carimbos ao recarregar a página.
