import { json, serviceClient } from "./_shared/whatsapp-auth";

// Pagina publica "Acompanhar pedido" (AcompanharPedido.tsx): o cliente so
// acessa o proprio pedido com o codigo (FAT-AAAAMMDD-NNNN) e o token que
// recebeu na hora da compra. get_instant_order ja existe no banco (RPC
// security definer, so service_role) comparando o hash do token - essa
// funcao so repassa a chamada para o navegador, que nao tem a service key.
export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const raw = await request.text();
  if (raw.length > 1024) return json({ error: "Requisição inválida." }, 413);
  let orderNumber = "";
  let token = "";
  try {
    const body = JSON.parse(raw);
    orderNumber = String(body.order_number || "").trim().toUpperCase();
    token = String(body.token || "").trim();
  } catch {
    return json({ error: "Pedido inválido." }, 400);
  }
  if (!/^FAT-\d{8}-\d{4}$/.test(orderNumber) || !/^[0-9a-f]{48}$/i.test(token)) {
    return json({ error: "Pedido não encontrado." }, 404);
  }
  const admin = serviceClient();
  if (!admin) return json({ error: "Serviço indisponível." }, 503);
  const { data, error } = await admin.rpc("get_instant_order", {
    order_code: orderNumber,
    order_token: token,
  });
  if (error) return json({ error: "Serviço indisponível." }, 503);
  if (!data) return json({ error: "Pedido não encontrado." }, 404);
  return json({ order: data });
};
export const config = { path: "/api/pedidos/acompanhar" };
