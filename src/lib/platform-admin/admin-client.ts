import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Lazy, shared service-role client for the platform super-admin panel.
// Mirrors the pattern used by the webhook handler and the automations /
// flows / ai admin clients — bypasses RLS on purpose, gated upstream by
// requirePlatformAdmin() (src/lib/auth/platform-admin.ts), never called
// directly from a client component.
let _adminClient: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _adminClient
}
