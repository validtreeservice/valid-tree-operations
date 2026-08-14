import { createClient } from '@supabase/supabase-js'

// These are public browser credentials, not server secrets. Keeping the live
// workspace values as fallbacks prevents Cloudflare/GitHub builds from silently
// becoming demo-only when the ignored local .env file is unavailable.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://ckowhtzcbvodptlbqour.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_iJbdXS3ZZ4OPqUY1AeVlcw_otsBDHh6'
export const isSupabaseConfigured = Boolean(url && key)
export const supabase = isSupabaseConfigured ? createClient(url, key) : null
