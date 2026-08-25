// ============================================================
// Kapso has no dedicated analytics endpoint (unlike phone numbers /
// templates / broadcasts / flows) — this aggregates it ourselves from
// outbound template messages + broadcast campaigns, scoped to this
// account's own phone_number_id. Approximates Kapso's own Analytics
// tab (Sent/Delivered/Read/Failed, per-template breakdown) but is
// computed here, not fetched pre-aggregated — see kapso-client.ts.
//
// Server component for the default range (30 days) — no "Loading…"
// flash on first paint. Switching ranges is handled client-side by
// AnalyticsClient, which the server render seeds with this data.
// ============================================================

import { getCurrentAccount } from "@/lib/auth/account";
import { getAccountPhoneNumberId } from "@/lib/platform-admin/kapso-inbox";
import { getAnalyticsForRange } from "@/lib/platform-admin/kapso-client";
import { AnalyticsClient, type AnalyticsResponse } from "./analytics-client";

const DEFAULT_RANGE = "30" as const;

export default async function AnalyticsPage() {
  const { accountId } = await getCurrentAccount();
  const phoneNumberId = await getAccountPhoneNumberId(accountId);

  let data: AnalyticsResponse | null = null;
  let error: string | null = null;
  if (!phoneNumberId) {
    error = "Kapso isn't configured for this account yet — ask JLB Systems to set it up";
  } else {
    try {
      data = await getAnalyticsForRange(phoneNumberId, DEFAULT_RANGE);
    } catch (err) {
      error = (err as Error).message;
    }
  }

  return <AnalyticsClient initialRange={DEFAULT_RANGE} initialData={data} initialError={error} />;
}
