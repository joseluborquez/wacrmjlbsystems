import { NextResponse } from "next/server";

import { toErrorResponse, getCurrentAccount } from "@/lib/auth/account";
import { getAccountPhoneNumberId } from "@/lib/platform-admin/kapso-inbox";
import {
  fetchOutboundTemplateAnalytics,
  fetchKapsoBroadcasts,
} from "@/lib/platform-admin/kapso-client";

const RANGE_DAYS: Record<string, number | null> = {
  "7": 7,
  "30": 30,
  all: null,
};

export async function GET(request: Request) {
  try {
    const { accountId } = await getCurrentAccount();
    const phoneNumberId = await getAccountPhoneNumberId(accountId);
    if (!phoneNumberId) {
      return NextResponse.json(
        { error: "Kapso isn't configured for this account yet — ask JLB Systems to set it up" },
        { status: 503 },
      );
    }

    const range = new URL(request.url).searchParams.get("range") ?? "30";
    const days = RANGE_DAYS[range] ?? 30;
    // "All time" still needs a floor for the messages API — Kapso
    // numbers here are all recent, so 2 years back is effectively
    // unbounded without asking the API to paginate forever.
    const since = new Date(
      Date.now() - (days ?? 730) * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [templateAnalytics, broadcasts] = await Promise.all([
      fetchOutboundTemplateAnalytics(phoneNumberId, since),
      fetchKapsoBroadcasts(phoneNumberId),
    ]);

    const sinceMs = new Date(since).getTime();
    const broadcastsInRange = broadcasts.filter(
      (b) => new Date(b.created_at).getTime() >= sinceMs,
    );
    const broadcastSummary = broadcastsInRange.reduce(
      (acc, b) => ({
        campaigns: acc.campaigns + 1,
        recipients: acc.recipients + b.total_recipients,
        sent: acc.sent + b.sent_count,
        delivered: acc.delivered + b.delivered_count,
        failed: acc.failed + b.failed_count,
      }),
      { campaigns: 0, recipients: 0, sent: 0, delivered: 0, failed: 0 },
    );

    return NextResponse.json({ templateAnalytics, broadcastSummary });
  } catch (err) {
    return toErrorResponse(err);
  }
}
