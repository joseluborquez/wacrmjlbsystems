// ============================================================
// Syncs Kapso conversation activity into wacrm's own generic pipeline
// (contacts + deals), per account. Deliberately NOT a full inbox
// rebuild — it reads only conversation-level metadata (no message
// bodies beyond the last one, which Kapso already includes), and only
// touches wacrm's own already-existing contacts/deals/pipelines
// tables. The Kapso iframe remains the place to actually read/reply
// to messages; this just gives the rest of the CRM (contacts, deals)
// real content to show.
//
// Stage derivation is deliberately generic — it only uses signals
// every Kapso-connected number has (conversation activity, assignment),
// never a client-specific scoring schema, since not every client has
// one built (see the "depende del tramo" conversation that led here).
// ============================================================

import { supabaseAdmin } from "./admin-client";
import { leerSecreto } from "./secrets";

const KAPSO_API_BASE = "https://api.kapso.ai/meta/whatsapp/v24.0";
const STALE_HOURS = 24;

interface KapsoConversation {
  id: string;
  phone_number: string;
  status: "active" | "ended";
  assigned_user_id: string | null;
  kapso: {
    contact_name: string | null;
    messages_count: number;
    last_message_text: string | null;
    last_inbound_at: string | null;
    last_outbound_at: string | null;
  };
}

async function fetchKapsoConversations(
  phoneNumberId: string,
  apiKey: string,
): Promise<KapsoConversation[]> {
  const res = await fetch(`${KAPSO_API_BASE}/${phoneNumberId}/conversations?limit=100`, {
    headers: { "X-API-Key": apiKey },
  });
  if (!res.ok) {
    throw new Error(`Kapso conversations API returned ${res.status}`);
  }
  const body = await res.json();
  return (body.data ?? []) as KapsoConversation[];
}

const STAGE_NEW = "Nuevo";
const STAGE_ACTIVE = "En conversación";
const STAGE_STALE = "Sin respuesta";
const STAGE_HANDOFF = "Derivado a persona";

function deriveStageName(conv: KapsoConversation): string {
  if (conv.assigned_user_id) return STAGE_HANDOFF;

  const lastIn = conv.kapso.last_inbound_at ? new Date(conv.kapso.last_inbound_at) : null;
  const lastOut = conv.kapso.last_outbound_at ? new Date(conv.kapso.last_outbound_at) : null;

  if (!lastIn) return STAGE_NEW;

  // Agent replied after the lead's last message and it's been quiet
  // since — the lead went cold, not the agent.
  if (lastOut && lastOut > lastIn) {
    const hoursSinceReply = (Date.now() - lastIn.getTime()) / (1000 * 60 * 60);
    if (hoursSinceReply > STALE_HOURS) return STAGE_STALE;
  }

  return STAGE_ACTIVE;
}

/** Syncs one account's Kapso conversations into its contacts/deals.
 * Returns how many deals were created vs. moved to a new stage. */
export async function syncAccountPipeline(
  accountId: string,
  phoneNumberId: string,
): Promise<{ created: number; moved: number; skipped: number }> {
  const apiKey = await leerSecreto("KAPSO_API_KEY");
  if (!apiKey) {
    throw new Error("KAPSO_API_KEY is not set in Vault — cannot call the Kapso API");
  }

  const db = supabaseAdmin();

  // Ensure the generic pipeline + its 4 stages exist for this account.
  const { data: pipelineId, error: seedErr } = await db.rpc("seed_default_pipeline", {
    p_account_id: accountId,
  });
  if (seedErr || !pipelineId) {
    throw new Error(`Could not seed default pipeline: ${seedErr?.message}`);
  }

  const { data: stages, error: stagesErr } = await db
    .from("pipeline_stages")
    .select("id, name")
    .eq("pipeline_id", pipelineId);
  if (stagesErr || !stages) {
    throw new Error(`Could not load pipeline stages: ${stagesErr?.message}`);
  }
  const stageIdByName = new Map(stages.map((s) => [s.name as string, s.id as string]));

  const { data: account, error: accountErr } = await db
    .from("accounts")
    .select("owner_user_id")
    .eq("id", accountId)
    .maybeSingle();
  if (accountErr || !account) {
    throw new Error(`Could not load account owner: ${accountErr?.message}`);
  }

  const conversations = await fetchKapsoConversations(phoneNumberId, apiKey);

  let created = 0;
  let moved = 0;
  let skipped = 0;

  for (const conv of conversations) {
    const phone = conv.phone_number;
    if (!phone) {
      skipped++;
      continue;
    }

    const stageName = deriveStageName(conv);
    const stageId = stageIdByName.get(stageName);
    if (!stageId) {
      skipped++;
      continue;
    }

    // contacts.phone_normalized is a GENERATED ALWAYS column backed by a
    // *partial* unique index (WHERE phone_normalized <> ''), which
    // Postgres can't use for ON CONFLICT inference — .upsert() with
    // onConflict fails with 42P10 on every row. Look the contact up by
    // hand instead (mirrors the deals lookup below).
    const phoneNormalized = phone.replace(/\D/g, "");
    const { data: existingContact } = await db
      .from("contacts")
      .select("id")
      .eq("account_id", accountId)
      .eq("phone_normalized", phoneNormalized)
      .maybeSingle();

    let contact = existingContact;
    if (!contact) {
      const { data: insertedContact, error: contactErr } = await db
        .from("contacts")
        .insert({
          account_id: accountId,
          user_id: account.owner_user_id,
          phone,
          name: conv.kapso.contact_name || null,
        })
        .select("id")
        .single();
      if (contactErr || !insertedContact) {
        console.error(`[syncAccountPipeline] contact insert failed for ${phone}:`, contactErr);
        skipped++;
        continue;
      }
      contact = insertedContact;
    }

    // Deals have no unique constraint to upsert against — find the
    // existing deal for this contact in this pipeline first.
    const { data: existingDeal } = await db
      .from("deals")
      .select("id, stage_id")
      .eq("account_id", accountId)
      .eq("pipeline_id", pipelineId)
      .eq("contact_id", contact.id)
      .maybeSingle();

    const dealTitle = conv.kapso.contact_name || phone;
    const notes = conv.kapso.last_message_text || null;

    if (!existingDeal) {
      const { error: insertErr } = await db.from("deals").insert({
        account_id: accountId,
        user_id: account.owner_user_id,
        pipeline_id: pipelineId,
        stage_id: stageId,
        contact_id: contact.id,
        title: dealTitle,
        notes,
      });
      if (insertErr) {
        console.error(`[syncAccountPipeline] deal insert failed for ${phone}:`, insertErr);
        skipped++;
        continue;
      }
      created++;
    } else if (existingDeal.stage_id !== stageId) {
      const { error: updateErr } = await db
        .from("deals")
        .update({ stage_id: stageId, notes })
        .eq("id", existingDeal.id);
      if (updateErr) {
        console.error(`[syncAccountPipeline] deal update failed for ${phone}:`, updateErr);
        skipped++;
        continue;
      }
      moved++;
    }
  }

  return { created, moved, skipped };
}
