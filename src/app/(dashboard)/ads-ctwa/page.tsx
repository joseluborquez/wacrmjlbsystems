// ============================================================
// Click-to-WhatsApp (CTWA) ad attribution. Kapso has no dedicated ads
// endpoint (same gap as Analytics) — Meta attaches a `referral` object
// to the first inbound message of a conversation that started from an
// ad click, so this walks inbound messages in range and aggregates by
// ad (referral.source_id). See kapso-client.ts.
//
// Server component for the default range (30 days) — see
// analytics/page.tsx for why. Switching ranges is handled client-side
// by AdsCtwaClient, seeded with this data.
// ============================================================

import { getCurrentAccount } from "@/lib/auth/account";
import { getAccountPhoneNumberId } from "@/lib/platform-admin/kapso-inbox";
import { getCtwaAttributionForRange } from "@/lib/platform-admin/kapso-client";
import { AdsCtwaClient, type CtwaAttribution } from "./ads-ctwa-client";

const DEFAULT_RANGE = "30" as const;

export default async function AdsCtwaPage() {
  const { accountId } = await getCurrentAccount();
  const phoneNumberId = await getAccountPhoneNumberId(accountId);

  let data: CtwaAttribution | null = null;
  let error: string | null = null;
  if (!phoneNumberId) {
    error = "Kapso isn't configured for this account yet — ask JLB Systems to set it up";
  } else {
    try {
      data = await getCtwaAttributionForRange(phoneNumberId, DEFAULT_RANGE);
    } catch (err) {
      error = (err as Error).message;
    }
  }

  return (
    <AdsCtwaClient initialRange={DEFAULT_RANGE} initialData={data} initialError={error} />
  );
}
