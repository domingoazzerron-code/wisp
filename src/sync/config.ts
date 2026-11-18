// Supabase project settings, copied from the legacy app. The publishable (anon) key is
// designed to be public; never put the service_role key here.
export const SUPABASE_URL = 'https://aotpesdchsjiekgnetrq.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_Jro4vk2E4E5PiE9_HHNdDw__L8mzhZF';

// localStorage keys used by sync (the data key itself lives in src/state/storage.ts).
export const META_MOD = 'cigtracker.mod';      // when local data last changed (ms)
export const META_SYN = 'cigtracker.synced';   // cloud updated_at (ms) this device last matched
export const LOCK_KEY = 'cigtracker.lock';     // app-lock key, also cleared on sign-out
