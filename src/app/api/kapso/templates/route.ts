import { NextResponse } from "next/server";

import { toErrorResponse, getCurrentAccount } from "@/lib/auth/account";
import { getAccountPhoneNumberId } from "@/lib/platform-admin/kapso-inbox";
import { fetchKapsoPhoneNumber, fetchKapsoTemplates } from "@/lib/platform-admin/kapso-client";

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
    // Templates are looked up per business_account_id, not per
    // phone_number_id — fetch the number first to resolve it.
    const number = await fetchKapsoPhoneNumber(phoneNumberId);
    const templates = await fetchKapsoTemplates(number.business_account_id);
    return NextResponse.json({ templates });
  } catch (err) {
    return toErrorResponse(err);
  }
}
