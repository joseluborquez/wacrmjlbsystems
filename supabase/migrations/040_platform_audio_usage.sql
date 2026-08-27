-- ============================================================
-- 040_platform_audio_usage.sql
--
-- First step toward billing clients for their share of JLB Systems'
-- shared Kapso audio-transcription pool (Kapso Pro: 5h/month of
-- transcription minutes, shared across ALL client accounts, not
-- metered per-client on Kapso's side). This table stores the result
-- of a MANUAL, per-account, per-calendar-month computation of how
-- many minutes of INBOUND WhatsApp voice-note audio a client sent —
-- triggered by a "Recalcular" button in the platform-admin panel
-- (src/app/platform-admin/actions.ts -> recalculateAudioUsageAction).
--
-- Kapso's messages API doesn't expose audio duration, so the actual
-- number comes from downloading each voice note's raw file and
-- parsing the Ogg/Opus container directly (see
-- src/lib/platform-admin/kapso-audio-usage.ts).
--
-- This is measurement only. No cost/invoicing columns on purpose —
-- the billing model (flat rate? proportional pool share?) hasn't
-- been decided yet and doesn't belong in this migration.
--
-- Upsert key: (account_id, period_start, period_end). Re-running the
-- button for the same account within the same calendar month always
-- computes identical UTC month boundaries, so it updates the same
-- row instead of accumulating duplicates.
--
-- RLS: enabled with NO policies. This table is only ever touched by
-- supabaseAdmin() (service role) from platform-admin server actions,
-- gated upstream by requirePlatformAdmin() — same posture as
-- kapso_inbox_configs. No client account, and no platform-admin
-- browser session, ever reads this table through PostgREST directly.
--
-- Idempotent — safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_audio_usage (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  period_start    timestamptz NOT NULL,
  period_end      timestamptz NOT NULL,
  total_seconds   numeric(12, 3) NOT NULL DEFAULT 0,
  message_count   integer NOT NULL DEFAULT 0,   -- voice notes found in the period
  processed_count integer NOT NULL DEFAULT 0,   -- voice notes actually downloaded/parsed
  skipped_count   integer NOT NULL DEFAULT 0,   -- subset of processed_count that failed
  truncated       boolean NOT NULL DEFAULT false,
  computed_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  computed_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_audio_usage_period_unique
    UNIQUE (account_id, period_start, period_end)
);

-- account_id: every per-account lookup filters on it (the unique
-- constraint's index also starts with account_id, but spelled out
-- per repo convention — see api_keys_account_id_idx in 026).
CREATE INDEX IF NOT EXISTS platform_audio_usage_account_id_idx
  ON platform_audio_usage (account_id);

ALTER TABLE platform_audio_usage ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only, see banner comment above.
