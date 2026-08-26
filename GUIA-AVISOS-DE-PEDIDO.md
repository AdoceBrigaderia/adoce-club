# Como ligar os avisos de pedido

**08/08/2026** · Dois canais independentes. Se um falhar, o outro avisa.

| Canal | O que faz | Onde chega |
|---|---|---|
| **Web Push** | Canal oficial. Abre direto na tela certa da Operação. | Celular com o site instalado |
| **Telegram** | Rede de segurança. Mensagem completa: sabores, caldas, total. | Celular e computador |

Nada disto chega ao cliente. É só para você e a Beth.

As cinco variáveis já foram criadas no Netlify, nos dois ambientes, com valores de exemplo. Você só edita.

---

## Parte 1 — Web Push (10 minutos)

### 1.1 Pegar as chaves

Abra `CHAVES-WEB-PUSH.txt`, na pasta do projeto. Ele tem três valores.

⚠️ **Não mande esse arquivo para ninguém, e não cole o conteúdo em conversa nenhuma.** A chave privada é o que impede outra pessoa de mandar notificação em nome da Adoce. Apague o arquivo depois que terminar esta parte.

### 1.2 Colocar no Netlify

Vá em **Site settings → Environment variables**. As variáveis já estão lá. Clique em **Options → Edit** em cada uma e troque o valor:

| Variável | Valor |
|---|---|
| `VITE_WEB_PUSH_PUBLIC_KEY` | a chave pública do arquivo |
| `WEB_PUSH_PRIVATE_KEY` | a chave privada do arquivo |
| `WEB_PUSH_SUBJECT` | já está certo, não mexa |

Na `WEB_PUSH_PRIVATE_KEY`, marque **Contains secret values** ao editar.

Faça isso nos **dois** projetos: `adocebrigaderia` (produção) e `adoce-homologacao`.

### 1.3 Ativar no seu celular

Depois que o site for publicado:

1. Abra a Operação Adoce no celular
2. Toque em **Alertas**
3. Toque em **Ativar neste aparelho**
4. Autorize quando o navegador perguntar

**Esta é a única parte que só você pode fazer.** Sem esse toque não existe para onde enviar.

Repita no celular da Beth, com a conta dela.

📱 **No iPhone:** o site precisa estar instalado na tela de início (Compartilhar → Adicionar à Tela de Início). O iPhone não aceita notificação de site aberto no navegador.

---

## Parte 2 — Telegram (10 minutos)

### 2.1 Criar o bot

1. Abra o Telegram e procure por **@BotFather**
2. Envie `/newbot`
3. Ele pede um nome — pode ser `Avisos Adoce`
4. Ele pede um usuário — precisa terminar em `bot`, por exemplo `avisos_adoce_bot`
5. Ele responde com um código comprido

⚠️ Esse código é uma senha. **Não cole em conversa nenhuma**, nem aqui comigo. Vai direto para o Netlify.

### 2.2 Descobrir para quem enviar

O bot só fala com quem falar com ele primeiro.

1. Abra a conversa do bot que você acabou de criar
2. Toque em **Iniciar** e mande qualquer mensagem, um "oi" serve
3. Peça para a Beth fazer o mesmo, no celular dela
4. Abra no navegador, trocando `SEU_TOKEN` pelo código do passo 2.1:

```
https://api.telegram.org/botSEU_TOKEN/getUpdates
```

Vai aparecer um texto com `"chat":{"id":123456789`. Esse número é o seu. O da Beth aparece também, depois que ela mandar a mensagem dela.

### 2.3 Colocar no Netlify

| Variável | Valor |
|---|---|
| `TELEGRAM_BOT_TOKEN` | o código do BotFather — marque como secreto |
| `TELEGRAM_CHAT_IDS` | os dois números separados por vírgula, sem espaço: `123456789,987654321` |

Nos dois projetos.

---

## Como saber se funcionou

Faça um pedido de teste em homologação. Em até um minuto:

- chega a notificação no celular
- chega a mensagem no Telegram, com os sabores e o total

Se não chegar, em **Netlify → Functions** abra `alerta-pedidos` ou `alerta-telegram` e veja o log. Ele diz exatamente o que faltou.

---

## Duas coisas que decidi e você deve saber

**Aviso com mais de 24 horas não toca o celular.** Existem 117 avisos represados desde 22/07. Sem essa trava, todos chegariam de uma vez. Eles continuam visíveis na Operação — só não viram notificação.

**Depois de 5 tentativas o aviso desiste.** Fica marcado como falho, mas continua na tela da Operação. Nada some.
