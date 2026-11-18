import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.ts';
import type { Backend, CloudRow } from './engine.ts';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Table `user_data(user_id, data jsonb, updated_at)`, one row per user (as in the legacy app). */
export const supabaseBackend: Backend = {
  async fetchRow(userId) {
    const r = await supabase.from('user_data').select('data,updated_at').eq('user_id', userId).maybeSingle();
    if (r.error) return { row: null, error: r.error.message };
    return { row: (r.data as CloudRow | null) ?? null };
  },
  async upsertRow(userId, data, updatedAt) {
    const r = await supabase.from('user_data').upsert({ user_id: userId, data, updated_at: updatedAt });
    return r.error ? { error: r.error.message } : {};
  },
};
