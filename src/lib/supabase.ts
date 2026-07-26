import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

/**
 * Compatibilidade temporária com módulos legados de desenvolvimento.
 * A preferência de persistência não grava mais qualquer dado no navegador.
 * As superfícies reais de cliente e operação usam somente o BFF e cookies HttpOnly.
 */
export function setRememberLogin(_remember: boolean) {
  return undefined;
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error("Backend ainda não configurado neste ambiente.");
  }

  return supabase;
}
