'use client'
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'ggmax-auth',
      },
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 30, // 30 dias
        sameSite: 'lax',
        secure: true,
      }
    }
  )
}