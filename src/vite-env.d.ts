/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_ENABLE_PASSKEYS?: string;
  readonly VITE_META_WHATSAPP_ENABLED?: string;
  readonly VITE_WHATSAPP_AUTH_ENABLED?: string;
  readonly VITE_WHATSAPP_AUTH_PILOT_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
