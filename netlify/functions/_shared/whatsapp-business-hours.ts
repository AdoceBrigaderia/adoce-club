export const ordersClosedMessage="Olá! 💗 Obrigada pelo carinho e pelo interesse nas nossas fatias! Recebemos pedidos do Festival de Fatias de terça a sábado, das 12h às 22h. Neste momento, estamos fora do horário de pedidos, mas vamos adorar atender você quando voltarmos. Esperamos você por aqui! 🍰\n\nPara falar com a equipe, digite ATENDENTE.";
export const supportClosedMessage="Olá! 💗 Nossa equipe responde de segunda a sábado, das 9h às 22h. Pode deixar sua mensagem por aqui; responderemos quando o atendimento retornar.";
export function whatsappHours(date=new Date()) {
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Fortaleza",weekday:"short",hour:"2-digit",hourCycle:"h23"}).formatToParts(date);
  const day=parts.find(part=>part.type==="weekday")?.value||"";
  const hour=Number(parts.find(part=>part.type==="hour")?.value);
  return {orders:["Tue","Wed","Thu","Fri","Sat"].includes(day)&&hour>=12&&hour<22,
    support:["Mon","Tue","Wed","Thu","Fri","Sat"].includes(day)&&hour>=9&&hour<22};
}
