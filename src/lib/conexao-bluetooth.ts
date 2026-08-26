// A ponte com a impressora, por Web Bluetooth.
//
// Funciona no Chrome do Android — que e o caso do tablet VAIO TL10, Android 13.
// Nao funciona no iPhone nem no iPad: o Safari nao fala Bluetooth com a pagina.
//
// O pareamento inicial exige um toque humano, por seguranca do navegador: uma
// pagina nao sai varrendo aparelhos sozinha. Depois disso ela imprime o dia
// inteiro sem ninguem tocar em nada.

import { fatiar, montarBytes, type Ficha } from "./impressora-termica";

// O TypeScript nao traz os tipos de Web Bluetooth por padrao. Declaramos so o
// que usamos, em vez de puxar um pacote inteiro de tipos por cinco chamadas.
type CaracteristicaBt = {
  writeValueWithoutResponse: (dados: ArrayBuffer) => Promise<void>;
};
type ServicoBt = { getCharacteristic: (id: number) => Promise<CaracteristicaBt> };
type ServidorBt = { getPrimaryService: (id: number) => Promise<ServicoBt> };
type AparelhoBt = {
  name?: string;
  gatt?: { connected: boolean; connect: () => Promise<ServidorBt>; disconnect: () => void };
  addEventListener: (evento: string, ouvinte: () => void) => void;
};
type BluetoothDoNavegador = {
  requestDevice: (opcoes: {
    filters?: Array<{ services?: number[]; namePrefix?: string }>;
    optionalServices?: number[];
    acceptAllDevices?: boolean;
  }) => Promise<AparelhoBt>;
  getDevices?: () => Promise<AparelhoBt[]>;
};

const bluetoothDoNavegador = () =>
  (navigator as Navigator & { bluetooth?: BluetoothDoNavegador }).bluetooth;

/** Servico serial que as termicas chinesas de 58 mm expoem. */
const SERVICO = 0x18f0;
const CARACTERISTICA = 0x2af1;

export type EstadoDaImpressora =
  | "sem_suporte"      // navegador nao fala Bluetooth
  | "desconectada"
  | "conectando"
  | "pronta"
  | "imprimindo"
  | "erro";

export const navegadorSuporta = () =>
  typeof navigator !== "undefined" && Boolean(bluetoothDoNavegador());

type Alvo = { device: AparelhoBt; characteristic: CaracteristicaBt };

let alvo: Alvo | null = null;

/**
 * Pede o aparelho ao usuario. So funciona a partir de um toque — o navegador
 * exige, e faz sentido: pagina que escaneia Bluetooth sozinha e problema.
 */
export async function parear(): Promise<void> {
  if (!navegadorSuporta()) throw new Error("Este navegador não fala Bluetooth. Use o Chrome no Android.");

  const device = await bluetoothDoNavegador()!.requestDevice({
    filters: [{ services: [SERVICO] }],
    // Algumas Knup anunciam so pelo nome, sem o servico na propaganda.
    optionalServices: [SERVICO],
  });

  await conectarAoAparelho(device);
}

async function conectarAoAparelho(device: AparelhoBt) {
  const servidor = await device.gatt?.connect();
  if (!servidor) throw new Error("Não foi possível conectar à impressora.");
  const servico = await servidor.getPrimaryService(SERVICO);
  const characteristic = await servico.getCharacteristic(CARACTERISTICA);

  alvo = { device, characteristic };

  // Impressora desligada ou fora de alcance derruba a conexao. Guardamos o
  // aparelho para reconectar sem pedir pareamento de novo.
  device.addEventListener("gattserverdisconnected", () => { alvo = null; });
}

/**
 * Reconecta sem perguntar nada, se o navegador ainda lembrar do aparelho.
 * E o que faz a impressao continuar depois de a impressora ficar sem bateria.
 */
export async function reconectarSePossivel(): Promise<boolean> {
  if (alvo?.device.gatt?.connected) return true;
  const bt = bluetoothDoNavegador();
  if (!bt?.getDevices) return false;
  try {
    const conhecidos = await bt.getDevices();
    for (const device of conhecidos) {
      try { await conectarAoAparelho(device); return true; } catch { /* tenta o proximo */ }
    }
  } catch { /* sem permissao guardada */ }
  return false;
}

export const estaPronta = () => Boolean(alvo?.device.gatt?.connected);

export async function imprimir(ficha: Ficha): Promise<void> {
  if (!estaPronta() && !(await reconectarSePossivel())) {
    throw new Error("Impressora não conectada.");
  }
  const pedacos = fatiar(montarBytes(ficha));
  for (const pedaco of pedacos) {
    // Cópia própria do buffer: fatias de um Uint8Array compartilham memória,
    // e algumas pilhas Bluetooth enviam o buffer inteiro em vez do pedaço.
    const copia = new Uint8Array(pedaco).buffer;
    await alvo!.characteristic.writeValueWithoutResponse(copia);
    // A Knup engasga sem respiro entre os pacotes: sai meia ficha.
    await new Promise((r) => setTimeout(r, 24));
  }
}

/** Teste de bancada, para conferir papel e acento sem gastar um pedido real. */
export async function imprimirTeste(): Promise<void> {
  await imprimir({
    numero: "TESTE",
    cliente: "Conferência de impressão",
    telefone: "(85) 99999-9999",
    itens: [
      { sabor: "Trufado de Ninho", quantidade: 1, calda: "Calda de chocolate", presente: false },
      { sabor: "Torta de Pudim", quantidade: 1, calda: null, presente: true },
    ],
    total: 41,
    retirada: "Cantinho da Adoce · a partir das 18h",
    observacao: "Acentuação: ação, coração, pêssego, José.",
    criadoEm: new Date().toISOString(),
  });
}

export function desconectar() {
  alvo?.device.gatt?.disconnect();
  alvo = null;
}
