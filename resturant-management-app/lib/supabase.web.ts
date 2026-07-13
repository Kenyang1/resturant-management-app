/**
 * Supabase client for Expo web. Skips expo-sqlite install; session persistence uses browser storage.
 * `detectSessionInUrl: false` because we exchange the password-reset `?code=` ourselves in
 * app/reset-password.tsx — auto-detection can't tell "just exchanged a recovery code" apart
 * from "user already had a session", so it can't drive that screen's valid/invalid link state.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in environment')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
})
