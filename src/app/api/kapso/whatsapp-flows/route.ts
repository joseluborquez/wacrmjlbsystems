import { NextResponse } from "next/server";

import { toErrorResponse, getCurrentAccount } from "@/lib/auth/account";
import { getAccountPhoneNumberId } from "@/lib/platform-admin/kapso-inbox";
import { fetchKapsoWhatsappFlows } from "@/lib/platform-admin/kapso-client";

export async function GET() {
  try {
    const { accountId } = await getCurrentAccount();
    const phoneNumberId = await getAccountPhoneNumberId(accountId);
    if (!phoneNumberId) {
      return NextResponse.json(
        { error: "Kapso isn't configured for this account yet — ask JLB Systems to set it up" },
        { status: 503 },
      );
    }
    const flows = await fetchKapsoWhatsappFlows(phoneNumberId);
    return NextResponse.json({ flows });
  } catch (err) {
    return toErrorResponse(err);
  }
}
