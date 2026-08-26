---
title: Identidade, segurança de acesso e validação
description: Login do cliente, prevenção de duplicidade, tratamento de contas e critérios obrigatórios de publicação.
status: Publicado no domínio principal, com validação controlada ainda necessária
---

# Identidade, segurança de acesso e validação

## Identidade principal do cliente

O acesso cotidiano do cliente passa a usar **celular com DDD e senha**. O código enviado por e-mail permanece para o primeiro acesso, recuperação e validações de segurança.

O Clube também aceita login social por **Google** e **Facebook**, sem substituir os métodos existentes. Os segredos desses provedores ficam configurados apenas no Supabase e nunca são enviados ao navegador. Quando o provedor confirma o mesmo e-mail já ligado à conta, a identidade social pode reutilizar o cadastro existente. Contas sem o mesmo e-mail confirmado não são unificadas automaticamente por telefone; possíveis duplicidades continuam seguindo a revisão administrativa. Instagram não é oferecido como botão de login porque não existe suporte nativo adequado para autenticação geral de clientes nesse fluxo.

A operação oferece os mesmos botões de Google e Facebook como conveniência, sem transformar a conta social em autorização administrativa. Depois da autenticação, o acesso interno continua condicionado a um registro ativo do mesmo identificador em `staff_members`. Uma conta autenticada que não possua esse vínculo permanece fora da operação, e nenhuma permissão é inferida do e-mail ou dos metadados enviados pelo provedor.

O primeiro acesso deve seguir esta ordem:

1. confirmar o e-mail;
2. concluir nome, termos e preferências;
3. confirmar o WhatsApp;
4. verificar que o telefone não pertence a outro cadastro;
5. criar uma senha com no mínimo 6 caracteres, sem exigência de maiúsculas, minúsculas, números ou símbolos;
6. oferecer passkey/biometria como alternativa opcional;
7. permitir que o cliente escolha continuar conectado no aparelho.

A opção aparece como **Manter conectado** e explica que o login só será solicitado novamente quando o cliente escolher **Sair**. Com a sessão persistida, a Home pública pode reconhecer o cliente e mostrar somente o resumo do próprio cartão, sem expor dados de outra pessoa ou qualquer informação operacional.

Passkeys permanecem sob sinalização de recurso experimental e não substituem a senha enquanto a integração não estiver validada nos aparelhos atendidos pela Adoce.

O envio e a validação do código por e-mail passam por rotas do próprio site antes de chegar ao Supabase. Isso evita que uma falha de conexão direta do navegador apareça apenas como `Failed to fetch` e permite mensagens seguras de indisponibilidade, limite de tentativas ou conta não encontrada. A entrega para clientes reais depende de provedor SMTP liberado no ambiente de produção.

## Migração dos clientes existentes

Clientes atuais preservam o mesmo identificador, cartão, carimbos, prêmios, indicações e histórico. No primeiro acesso após a mudança, usam o código de e-mail uma última vez, confirmam o telefone e criam a senha.

Quando o telefone já estiver ligado a outro cadastro, o sistema não cria a nova identidade e encaminha o caso para revisão de duplicidade. Nenhuma unificação deve acontecer automaticamente.

## Prevenção de duplicidade e autoindicação

- telefone confirmado é único no cadastro;
- o telefone é normalizado antes da comparação;
- a criação da senha exige WhatsApp confirmado;
- um perfil não pode indicar a si mesmo;
- membros do mesmo Cartão em Grupo não geram indicação entre si;
- cadastro inativo, em exclusão ou marcado como duplicado não inicia nem confirma indicação;
- uma pessoa indicada só pode possuir um vínculo de indicação;
- possíveis duplicidades ficam disponíveis para revisão por proprietário ou gerente;
- toda tentativa bloqueada relevante gera registro de auditoria.

## Tratamento administrativo de contas

As ações disponíveis para proprietário e gerente são:

- desativar acesso;
- reativar acesso;
- registrar solicitação de exclusão;
- excluir o cadastro imediatamente, removendo o acesso e anonimizando os dados pessoais vinculados;
- cancelar solicitação de exclusão;
- marcar cadastro duplicado para revisão.

Toda ação exige um motivo entre cadastro duplicado, solicitação do cliente, cadastro criado por engano ou teste, revisão de segurança, violação dos termos, obrigação legal ou administrativa e outro motivo com observação obrigatória.

A ação registra operador, cliente, estado anterior, estado resultante, motivo, observação, data, tentativa de notificação e resultado do envio. O operador não pode aplicar a ação ao próprio cadastro nessa tela.

Na exclusão definitiva, a conta de autenticação recebe exclusão segura, o perfil deixa de aparecer na busca de membros e os dados pessoais do cadastro são anonimizados. Carimbos, pedidos e auditoria indispensáveis permanecem apenas como histórico operacional, sem permitir novo acesso. Cadastros que estavam em `pending_deletion` podem ser finalizados diretamente pela operação.

Proprietários e gerentes podem corrigir o nome do cliente na própria ficha. A alteração também atualiza a identidade de acesso e fica registrada na auditoria. Novos cadastros não aceitam nomes genéricos como “Cliente”, “Cliente Adoce”, “Teste”, “Sem nome” ou “Não informado”. A área de membros exibe o total de clientes e a separação entre ativos, desativados e aguardando exclusão; contas da equipe e perfis anonimizados não entram nessa contagem.

## Exclusão, retenção e histórico

O botão administrativo não apaga imediatamente o histórico de fidelidade. A primeira etapa bloqueia o acesso, impede novas operações do cliente e registra a solicitação. Exclusão definitiva ou anonimização deve respeitar a política de retenção e as obrigações aplicáveis.

Carimbos, recompensas, resgates e auditoria não podem ser silenciosamente removidos. Uma eventual unificação precisa transferir e conferir os vínculos antes de desativar definitivamente o cadastro duplicado.

## Notificação ao cliente

Quando houver e-mail, a mudança administrativa envia uma mensagem compatível com o motivo. Revisões de segurança usam linguagem preventiva e não acusatória. Cadastros duplicados informam a revisão ou futura unificação. Solicitações do titular recebem confirmação do andamento.

Se o provedor de envio não estiver disponível, a ação permanece registrada com notificação pendente; ela não pode ser apresentada como e-mail enviado.

## Critério obrigatório de publicação

Uma mudança só pode ser declarada pronta quando houver evidência de:

1. migração aplicada no banco correto;
2. políticas de acesso e funções administrativas revisadas;
3. testes automatizados aprovados;
4. build de produção aprovado;
5. cadastro novo testado;
6. cliente existente migrado sem perda de saldo;
7. telefone duplicado bloqueado;
8. autoindicação e indicação entre contas inválidas bloqueadas;
9. desativação, reativação e solicitação de exclusão auditadas;
10. notificação verificada ou identificada como pendente;
11. sessão lembrada e sessão temporária testadas;
12. recuperação por e-mail testada;
13. revisão visual no computador e no celular;
14. aprovação da prévia antes da publicação;
15. verificação final nos domínios oficiais após a publicação.

Pedidos públicos utilizam número rastreável e token aleatório de acesso, sem expor consultas por telefone ou dados de outros clientes. O vínculo com o Clube só pode ser consultado por sessão autenticada ou pela equipe. Mudanças para pronto ou entregue exigem pagamento aprovado no próprio banco, independentemente do botão usado pela interface.

## Estado desta entrega

A estrutura de banco, serviços protegidos no servidor, login com telefone e senha, opção de manter a sessão, preparação para passkeys e controles administrativos foram publicados em 20/07/2026. As migrações foram aplicadas no projeto de produção e a chave segura do servidor foi configurada na Netlify sem exposição ao cliente. Os 21 perfis existentes foram preservados como ativos. As rotas e funções protegidas foram verificadas no domínio principal; permanece obrigatória a validação com uma conta controlada antes de anunciar a migração de acesso aos clientes. Notificações administrativas ficam registradas como pendentes quando o provedor de e-mail da função não estiver configurado.
