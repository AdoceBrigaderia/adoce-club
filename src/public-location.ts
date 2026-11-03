// Fonte única dos dados de localização do Cantinho da Adoce (loja física), usada
// pelo modal "Nossa localização" do rodapé público. Nunca duplicar/copiar estes
// textos em outro arquivo -- importar daqui.
//
// Regra de negócio (pedido do proprietário em 02/11/2026): o endereço da Av. da
// Saudade, sozinho, não localiza a loja certinho nos apps de navegação. Por isso
// Maps, Waze e Uber usam o nome comercial como destino, e só o app 99 usa um
// endereço alternativo (a rua que cruza perto da loja).
const SEARCH_QUERY = "Cantinho da Adoce, Fortaleza, CE";

export const cantinhoDaAdoceLocation = {
  name: "Cantinho da Adoce",
  addressDisplay: "Av. da Saudade, s/n – Passaré, Fortaleza/CE",
  addressReference: "Em frente ao Condomínio Reserva dos Ipês",
  googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SEARCH_QUERY)}`,
  wazeUrl: `https://waze.com/ul?q=${encodeURIComponent(SEARCH_QUERY)}&navigate=yes`,
  uberUrl: `https://m.uber.com/ul/?action=setPickup&pickup=my_location&${new URLSearchParams({
    "dropoff[formatted_address]": SEARCH_QUERY,
    "dropoff[nickname]": "Cantinho da Adoce",
  }).toString()}`,
  // Único caso em que NÃO se usa o nome comercial: a 99 não encontra a loja por
  // nome nem pelo endereço da avenida, então usa a rua mais próxima como
  // referência de desembarque.
  ninetyNineAddress: "Rua Cento e Quatro, 277, Passaré, Fortaleza/CE",
} as const;

export async function copyNinetyNineAddress(): Promise<boolean> {
  const text = cantinhoDaAdoceLocation.ninetyNineAddress;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // segue para o fallback abaixo
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}
