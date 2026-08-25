// ============================================================
// Pulls Kapso conversation activity into wacrm's generic pipeline for
// every account that has a phone_number_id on file. Meant to be
// pinged on a schedule (Vercel Cron, a Hostinger cron job hitting this
// URL, cron-job.org, etc.) — no scheduler is wired up yet, this route
// just needs to exist and work when called.
//
// Gated by CRON_SECRET (a shared secret in the request, not a user
// session) since this isn't something a logged-in browser calls.
// Vercel Cron Jobs automatically send `Authorization: Bearer
// $CRON_SECRET` on every invocation when a project env var literally
// named CRON_SECRET is set — https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
// so that's the header this checks. Manual/local calls (e.g. curl)
// need to send that same header explicitly.
// ============================================================

import { NextResponse } from "next/server";

import { listAccountsForPipelineSync } from "@/lib/platform-admin/kapso-inbox";
import { syncAccountPipeline } from "@/lib/platform-admin/kapso-pipeline-sync";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await listAccountsForPipelineSync();
  const results = [];

  for (const { accountId, phoneNumberId } of accounts) {
    try {
      const summary = await syncAccountPipeline(accountId, phoneNumberId);
      results.push({ accountId, ...summary });
    } catch (err) {
      console.error(`[sync-kapso-pipeline] account ${accountId} failed:`, err);
      results.push({ accountId, error: (err as Error).message });
    }
  }

  return NextResponse.json({ synced: results.length, results });
}
