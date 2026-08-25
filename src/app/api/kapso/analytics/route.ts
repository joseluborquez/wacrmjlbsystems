import { NextResponse } from "next/server";

import { toErrorResponse, getCurrentAccount } from "@/lib/auth/account";
import { getAccountPhoneNumberId } from "@/lib/platform-admin/kapso-inbox";
import { getAnalyticsForRange } from "@/lib/platform-admin/kapso-client";

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
    const result = await getAnalyticsForRange(phoneNumberId, range);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
