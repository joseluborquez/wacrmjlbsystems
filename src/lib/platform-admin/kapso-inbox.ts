// ============================================================
// Per-account Kapso inbox embed tokens. Each client account gets its
// own Kapso inbox_embed, scoped to their own phone_number_id on the
// Kapso side — real isolation, not a shared embed filtered by search
// (a client could clear that search box and see everyone else's
// conversations). Only the platform admin sets these (requires the
// Kapso project API key); a client account never sees or manages its
// own token directly.
//
// Reuses the same AES-256-GCM encrypt/decrypt already used for
// whatsapp_config.access_token (src/lib/whatsapp/encryption.ts) so
// there's one encryption convention in the codebase, not two.
// ============================================================

import { encrypt, decrypt } from "@/lib/whatsapp/encryption";
import { supabaseAdmin } from "./admin-client";

export async function setAccountKapsoToken(
  accountId: string,
  token: string,
  phoneLabel: string | null,
  phoneNumberId: string | null,
  createdBy: string,
): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("kapso_inbox_configs").upsert(
    {
      account_id: accountId,
      encrypted_token: encrypt(token),
      phone_label: phoneLabel,
      phone_number_id: phoneNumberId,
      created_by: createdBy,
    },
    { onConflict: "account_id" },
  );
  if (error) {
    console.error("[setAccountKapsoToken] upsert failed:", error);
    throw new Error("Could not save the Kapso inbox token");
  }
}

export interface AccountKapsoConfig {
  accountId: string;
  phoneNumberId: string;
}

/** Every account that has a phone_number_id on file — what the pipeline
 * sync iterates over. Accounts with only a token (no phone_number_id
 * filled in yet) are skipped, not errored — same "not configured yet"
 * treatment as no token at all. */
export async function listAccountsForPipelineSync(): Promise<AccountKapsoConfig[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("kapso_inbox_configs")
    .select("account_id, phone_number_id")
    .not("phone_number_id", "is", null);
  if (error) {
    console.error("[listAccountsForPipelineSync] fetch failed:", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    accountId: r.account_id as string,
    phoneNumberId: r.phone_number_id as string,
  }));
}

export async function getAccountKapsoEmbedUrl(accountId: string): Promise<string | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("kapso_inbox_configs")
    .select("encrypted_token")
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) {
    console.error("[getAccountKapsoEmbedUrl] fetch failed:", error);
    throw new Error("Could not load the Kapso inbox config");
  }
  if (!data) return null;

  const token = decrypt(data.encrypted_token);
  return `https://inbox.kapso.ai/embed/${token}?mode=dark&language=en`;
}

/** The phone_number_id on file for one account, or null if the
 * platform admin hasn't configured it yet. Used by the Phone Numbers
 * and Templates pages to scope their Kapso API calls to this account's
 * own number — never the whole Kapso project. */
export async function getAccountPhoneNumberId(accountId: string): Promise<string | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("kapso_inbox_configs")
    .select("phone_number_id")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) {
    console.error("[getAccountPhoneNumberId] fetch failed:", error);
    throw new Error("Could not load the Kapso config for this account");
  }
  return (data?.phone_number_id as string | null) ?? null;
}

export async function listAccountsWithKapsoToken(): Promise<Set<string>> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("kapso_inbox_configs").select("account_id");
  if (error) {
    console.error("[listAccountsWithKapsoToken] fetch failed:", error);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.account_id as string));
}
