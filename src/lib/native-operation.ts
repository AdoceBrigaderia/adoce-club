import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Session } from "@supabase/supabase-js";
import {
  getSupabasePublicConfig,
  requireSupabase,
  setRememberLogin,
} from "./supabase";

type NativeOperationPlugin = {
  start(options: {
    supabaseUrl: string;
    publishableKey: string;
    accessToken: string;
    refreshToken: string;
  }): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  clearSession(): Promise<void>;
  getBiometricStatus(): Promise<{ available: boolean; savedSession: boolean }>;
  unlockWithBiometrics(): Promise<{ accessToken: string; refreshToken: string }>;
  discoverPrinter(): Promise<{ printer?: string }>;
  printTest(): Promise<void>;
  printSamples(): Promise<void>;
  printLargeSample(): Promise<void>;
  getStatus(): Promise<{ service: string; printer: string; pending: number }>;
};

const NativeOperation = registerPlugin<NativeOperationPlugin>("AdoceOperation");

export async function syncNativeOperationSession(session: Session | null) {
  if (!Capacitor.isNativePlatform()) return;
  if (!session) {
    await NativeOperation.pause();
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

export async function getNativeBiometricStatus() {
  if (!Capacitor.isNativePlatform()) {
    return { available: false, savedSession: false };
  }
  return NativeOperation.getBiometricStatus();
}

export async function restoreNativeOperationSessionWithBiometrics() {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("A biometria está disponível somente no aplicativo da operação.");
  }
  const saved = await NativeOperation.unlockWithBiometrics();
  setRememberLogin(true);
  const { data, error } = await requireSupabase().auth.setSession({
    access_token: saved.accessToken,
    refresh_token: saved.refreshToken,
  });
  if (error || !data.session) {
    throw new Error("Sua sessão expirou. Entre uma vez com a senha para ativar a biometria novamente.");
  }
  await syncNativeOperationSession(data.session);
  return data.session;
}

export async function clearNativeOperationSession() {
  if (!Capacitor.isNativePlatform()) return;
  await NativeOperation.clearSession();
}

export { NativeOperation };
