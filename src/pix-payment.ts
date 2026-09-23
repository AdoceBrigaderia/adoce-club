export const ADOCE_PIX_KEY = "pagamentos@adocebrigaderia.com.br";

export const pixInstructions = () => [
  "Pagamento via Pix.",
  `Chave (e-mail): ${ADOCE_PIX_KEY}`,
  "Envie o comprovante nesta conversa. A equipe da Adoce vai conferir o pagamento.",
].join("\n");
