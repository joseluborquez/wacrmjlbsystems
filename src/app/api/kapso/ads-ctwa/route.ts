import { NextResponse } from "next/server";

import { toErrorResponse, getCurrentAccount } from "@/lib/auth/account";
import { getAccountPhoneNumberId } from "@/lib/platform-admin/kapso-inbox";
import { fetchCtwaAttribution } from "@/lib/platform-admin/kapso-client";

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
    const since = new Date(
      Date.now() - (days ?? 730) * 24 * 60 * 60 * 1000,
    ).toISOString();

    const attribution = await fetchCtwaAttribution(phoneNumberId, since);
    return NextResponse.json(attribution);
  } catch (err) {
    return toErrorResponse(err);
  }
}
