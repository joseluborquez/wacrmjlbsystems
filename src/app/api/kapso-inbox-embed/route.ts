// ============================================================
// Serves the Kapso inbox embed URL for the CALLER'S OWN account. The
// embed token itself never reaches the browser — this route resolves
// the caller's account_id, reads that account's token server-side
// (service-role only, from kapso_inbox_configs), and hands back just
// the finished URL. Each account has its own token, scoped on the
// Kapso side to that account's own phone_number — real isolation
// between clients, not a shared embed filtered by search (a client
// could clear that filter and see everyone else's conversations).
//
// The token itself is set once by the platform admin (see
// /platform-admin — it requires the Kapso project API key, which a
// client account never has), not by the account holder.
// ============================================================

import { NextResponse } from "next/server";

import { toErrorResponse, getCurrentAccount } from "@/lib/auth/account";
import { getAccountKapsoEmbedUrl } from "@/lib/platform-admin/kapso-inbox";

export async function GET() {
  try {
    const { accountId } = await getCurrentAccount();

    const url = await getAccountKapsoEmbedUrl(accountId);
    if (!url) {
      return NextResponse.json(
        { error: "Kapso inbox isn't configured for this account yet — ask JLB Systems to set it up" },
        { status: 503 },
      );
    }

    return NextResponse.json({ url });
  } catch (err) {
    return toErrorResponse(err);
  }
}
