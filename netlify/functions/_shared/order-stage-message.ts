import { pixInstructions } from "../../../src/pix-payment";
export type StageOrder={customer_name:string;order_number:string;status:string;payment_status?:string;available_from?:string|null;total:number;payment_method_code:string|null;payment_url:string|null;pickup_label:string;pickup_address:string};
export function orderStageMessage(order:StageOrder, pixKey?:string) {
  const prefix=`Olá, ${order.customer_name.trim().split(/\s+/)[0]}! Pedido ${order.order_number}: `;
  const messages:Record<string,string>={
    awaiting_confirmation:`recebemos seu pedido de reserva.${order.available_from ? ` As fatias têm previsão de disponibilidade a partir de ${order.available_from.slice(0,5)}.` : " Vamos conferir a disponibilidade."} Assim que estiverem disponíveis, a equipe fará a separação e avisará quando o pedido estiver confirmado. Aguarde antes de pagar.`,
    reserved:`sua reserva foi registrada.${order.available_from ? ` A previsão de disponibilidade das fatias é a partir de ${order.available_from.slice(0,5)}.` : ""} Quando estiverem disponíveis, faremos a separação e avisaremos a confirmação do pedido. Aguarde antes de pagar.`,
    awaiting_payment:`suas fatias já foram separadas pela equipe e o pedido está confirmado. Total ${Number(order.total).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}. ${order.payment_method_code==="pix"?pixInstructions(pixKey):order.payment_url?`Pague pelo link: ${order.payment_url}`:"A equipe vai orientar o pagamento por aqui."} Aguarde nossa liberação antes de retirar.`,
    paid:"pagamento confirmado pela equipe da Adoce. Muito obrigada pela preferência! 💗 Aguarde nossa liberação para retirada.",
    preparing:`${order.payment_status==="approved"?"Pagamento confirmado pela equipe. ":""}Suas fatias estão em separação. Avisaremos quando essa etapa for concluída.`,
    ready:`pronto para retirada! ${order.pickup_label}: ${order.pickup_address}`,
    completed:"entrega registrada. Obrigado por escolher a Adoce!",
    cancelled:"pedido cancelado. Se tiver alguma dúvida ou já tiver pago, fale com a equipe por aqui.",
    expired:"o prazo da reserva encerrou. Fale com a equipe para verificar a disponibilidade antes de pagar.",
  };
  if(!messages[order.status]) throw new Error("unknown_order_stage");
  return prefix+messages[order.status];
}
