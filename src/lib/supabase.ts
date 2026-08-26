import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

const rememberPreferenceKey = "adoce-remember-login";
const browserStorage = typeof window === "undefined" ? undefined : {
  getItem(key: string) {
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (window.localStorage.getItem(rememberPreferenceKey) === "false") {
      window.localStorage.removeItem(key);
      window.sessionStorage.setItem(key, value);
    } else {
      window.sessionStorage.removeItem(key);
      window.localStorage.setItem(key, value);
    }
  },
  removeItem(key: string) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export function setRememberLogin(remember: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(rememberPreferenceKey, String(remember));
}

export function getRememberLoginPreference() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(rememberPreferenceKey) !== "false";
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: browserStorage,
        experimental: { passkey: true },
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error("Backend ainda não configurado neste ambiente.");
  }

  return supabase;
}
