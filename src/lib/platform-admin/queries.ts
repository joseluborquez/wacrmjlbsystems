// ============================================================
// Read-only aggregate queries for the platform super-admin panel.
//
// Deliberately avoids embedded FK selects (e.g. `messages.select(
// "conversations!inner(account_id)")`) — the codebase's own account.ts
// documents why: PostgREST's embed relies on a schema-cache lookup that
// can go stale right after a migration (issue #294) and fails hard with
// PGRST200. These queries instead pull flat rows and join in JS, same
// tradeoff already made in getCurrentAccount().
// ============================================================

import { supabaseAdmin } from "./admin-client";

export interface PlatformAccountSummary {
  id: string;
  name: string;
  createdAt: string;
  ownerEmail: string | null;
  contactsCount: number;
  conversationsCount: number;
  messagesLast30d: number;
  whatsappStatus: "connected" | "disconnected" | "not_configured";
}

export async function loadPlatformAccounts(): Promise<PlatformAccountSummary[]> {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: accounts, error: accountsErr },
    { data: profiles },
    { data: contacts },
    { data: conversations },
    { data: whatsapp },
    { data: recentMessages },
  ] = await Promise.all([
    db
      .from("accounts")
      .select("id, name, created_at, owner_user_id")
      .order("created_at", { ascending: false }),
    db.from("profiles").select("user_id, email").eq("account_role", "owner"),
    db.from("contacts").select("account_id"),
    db.from("conversations").select("id, account_id"),
    db.from("whatsapp_config").select("account_id, status"),
    db.from("messages").select("conversation_id, created_at").gte("created_at", since),
  ]);

  if (accountsErr) {
    console.error("[loadPlatformAccounts] accounts fetch error:", accountsErr);
    throw new Error("Could not load accounts");
  }

  const ownerEmailByUserId = new Map<string, string | null>(
    (profiles ?? []).map((p) => [p.user_id as string, p.email as string | null]),
  );
  const contactsCountByAccount = countBy(contacts ?? [], "account_id");
  const conversationsCountByAccount = countBy(conversations ?? [], "account_id");
  const whatsappByAccount = new Map<string, string>(
    (whatsapp ?? []).map((w) => [w.account_id as string, w.status as string]),
  );
  const accountIdByConversationId = new Map<string, string>(
    (conversations ?? []).map((c) => [c.id as string, c.account_id as string]),
  );

  const messagesCountByAccount = new Map<string, number>();
  for (const row of recentMessages ?? []) {
    const accountId = accountIdByConversationId.get(row.conversation_id as string);
    if (!accountId) continue;
    messagesCountByAccount.set(accountId, (messagesCountByAccount.get(accountId) ?? 0) + 1);
  }

  return (accounts ?? []).map((a) => ({
    id: a.id as string,
    name: a.name as string,
    createdAt: a.created_at as string,
    ownerEmail: ownerEmailByUserId.get(a.owner_user_id as string) ?? null,
    contactsCount: contactsCountByAccount.get(a.id as string) ?? 0,
    conversationsCount: conversationsCountByAccount.get(a.id as string) ?? 0,
    messagesLast30d: messagesCountByAccount.get(a.id as string) ?? 0,
    whatsappStatus:
      (whatsappByAccount.get(a.id as string) as PlatformAccountSummary["whatsappStatus"]) ??
      "not_configured",
  }));
}

function countBy(rows: Record<string, unknown>[], key: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const k = row[key] as string;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}
