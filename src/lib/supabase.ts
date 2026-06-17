import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export async function checkSupabaseHealth() {
  if (!supabase) return { ok: false, message: 'Supabase nao configurado.' };

  const { error } = await supabase.from('app_settings').select('id').limit(1);
  if (error) return { ok: false, message: error.message };

  return { ok: true, message: 'Supabase conectado.' };
}
