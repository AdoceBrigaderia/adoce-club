import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Session } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./supabase";

type NativeOperationPlugin = {
  start(options: {
    supabaseUrl: string;
    publishableKey: string;
    accessToken: string;
    refreshToken: string;
  }): Promise<void>;
  stop(): Promise<void>;
  discoverPrinter(): Promise<{ printer?: string }>;
  printTest(): Promise<void>;
  printOrder(options: { orderJson: string }): Promise<void>;
  // Pedidos que chegaram sem ficha porque o app não estava ouvindo (fechado,
  // tablet desligado, impressora fora de alcance) nunca entram na fila local
  // — ela só guarda o que o canal em tempo real viu passar. Isto busca no
  // banco todo pedido ainda não finalizado e imprime o que faltar.
  printPendingOrders(): Promise<void>;
  getStatus(): Promise<{ service: string; printer: string; pending: number }>;
};

const NativeOperation = registerPlugin<NativeOperationPlugin>("AdoceOperation");

export async function syncNativeOperationSession(session: Session | null) {
  if (!Capacitor.isNativePlatform()) return;
  if (!session) {
    await NativeOperation.stop();
    return;
  }
  const config = getSupabasePublicConfig();
  if (!config.url || !config.publishableKey) return;
  await NativeOperation.start({
    supabaseUrl: config.url,
    publishableKey: config.publishableKey,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  });
}

export { NativeOperation };
