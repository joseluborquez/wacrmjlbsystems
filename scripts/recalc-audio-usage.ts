// One-off verification script — exercises the real Kapso API, real
// audio download, and a real Supabase write, without going through
// the platform-admin UI or the server action.
//
// Usage:
//   npx tsx scripts/recalc-audio-usage.ts <accountId> <phoneNumberId> <computedByUserId>
//
// computedByUserId must be a real auth.users id (the column is a uuid FK) —
// use a platform admin's own user id.
//
// Requires the same env vars the app itself needs (NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, and a KAPSO_API_KEY reachable via
// leer_secreto()) — export them into the shell first.

import { recalculateAudioUsage } from "../src/lib/platform-admin/kapso-audio-usage";

const [accountId, phoneNumberId, computedByUserId] = process.argv.slice(2);

if (!accountId || !phoneNumberId || !computedByUserId) {
  console.error("Usage: recalc-audio-usage.ts <accountId> <phoneNumberId> <computedByUserId>");
  process.exit(1);
}

recalculateAudioUsage(accountId, phoneNumberId, computedByUserId)
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
