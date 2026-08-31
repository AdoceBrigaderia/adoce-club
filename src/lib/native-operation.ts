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
