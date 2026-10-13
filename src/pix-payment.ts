// Chave Pix padrão (usada só se a configuração da loja não puder ser lida).
// A chave oficial é editável em Configurações → Loja e pagamentos.
export const DEFAULT_PIX_KEY = "pagamento@adocebrigaderia.com.br";
export const ADOCE_PIX_KEY = DEFAULT_PIX_KEY;

export const pixInstructions = (pixKey: string = DEFAULT_PIX_KEY) => [
  "Pagamento via Pix.",
  `Chave (e-mail): ${(pixKey || DEFAULT_PIX_KEY).trim()}`,
  "Envie o comprovante nesta conversa. A equipe da Adoce vai conferir o pagamento.",
].join("\n");
