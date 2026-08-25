// ============================================================
// Thin wrappers over Kapso's REST API for data that has no embed
// option (unlike the inbox — see kapso-inbox.ts). Every call here is
// scoped to a single phone_number_id / business_account_id, passed in
// by the caller (never "list everything in the project"), so a
// client account can only ever see its own number's data.
// ============================================================

import { leerSecreto } from "./secrets";

const PLATFORM_API_BASE = "https://api.kapso.ai/platform/v1";
const META_PROXY_BASE = "https://api.kapso.ai/meta/whatsapp/v24.0";

async function kapsoApiKey(): Promise<string> {
  const apiKey = await leerSecreto("KAPSO_API_KEY");
  if (!apiKey) {
    throw new Error("KAPSO_API_KEY is not set in Vault — cannot call the Kapso API");
  }
  return apiKey;
}

export interface KapsoPhoneNumber {
  id: string;
  phone_number_id: string;
  business_account_id: string;
  name: string;
  display_name: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
  status: string;
  throughput_tier: string;
  code_verification_status: string;
  inbound_processing_enabled: boolean;
  calls_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchKapsoPhoneNumber(phoneNumberId: string): Promise<KapsoPhoneNumber> {
  const apiKey = await kapsoApiKey();
  const res = await fetch(`${PLATFORM_API_BASE}/whatsapp/phone_numbers/${phoneNumberId}`, {
    headers: { "X-API-Key": apiKey },
  });
  if (!res.ok) {
    throw new Error(`Kapso phone number API returned ${res.status}`);
  }
  const body = await res.json();
  return body.data as KapsoPhoneNumber;
}

export interface KapsoTemplateComponent {
  type: string;
  format?: string;
  text?: string;
}

export interface KapsoTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components: KapsoTemplateComponent[];
}

export interface KapsoBroadcast {
  id: string;
  name: string;
  status: string;
  phone_number_id: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  delivered_count: number;
  response_rate: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export async function fetchKapsoBroadcasts(phoneNumberId: string): Promise<KapsoBroadcast[]> {
  const apiKey = await kapsoApiKey();
  const res = await fetch(
    `${PLATFORM_API_BASE}/whatsapp/broadcasts?phone_number_id=${phoneNumberId}&per_page=50`,
    { headers: { "X-API-Key": apiKey } },
  );
  if (!res.ok) {
    throw new Error(`Kapso broadcasts API returned ${res.status}`);
  }
  const body = await res.json();
  return (body.data ?? []) as KapsoBroadcast[];
}

export interface KapsoWhatsappFlow {
  id: string;
  name: string;
  status: string;
  meta_flow_id: string;
  json_version: string;
  has_data_endpoint: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchKapsoWhatsappFlows(
  phoneNumberId: string,
): Promise<KapsoWhatsappFlow[]> {
  const apiKey = await kapsoApiKey();
  const res = await fetch(
    `${PLATFORM_API_BASE}/whatsapp/flows?phone_number_id=${phoneNumberId}&per_page=50`,
    { headers: { "X-API-Key": apiKey } },
  );
  if (!res.ok) {
    throw new Error(`Kapso WhatsApp Flows API returned ${res.status}`);
  }
  const body = await res.json();
  return (body.data ?? []) as KapsoWhatsappFlow[];
}

interface KapsoOutboundMessage {
  type: string;
  template?: { name: string };
  kapso: { status: string; direction: string };
}

export interface TemplateStatRow {
  templateName: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

export interface OutboundTemplateAnalytics {
  totals: { sent: number; delivered: number; read: number; failed: number };
  byTemplate: TemplateStatRow[];
  messagesScanned: number;
  truncated: boolean;
}

// Kapso has no dedicated analytics endpoint — this walks outbound
// messages in the range and aggregates by (template name, final
// status) client-side. Capped at MAX_PAGES * 100 messages so a busy
// number can't turn one page load into an unbounded scrape; recent
// activity is what the analytics view cares about anyway.
const MAX_PAGES = 5;
const PAGE_SIZE = 100;

export async function fetchOutboundTemplateAnalytics(
  phoneNumberId: string,
  sinceIso: string,
): Promise<OutboundTemplateAnalytics> {
  const apiKey = await kapsoApiKey();
  const byTemplate = new Map<string, TemplateStatRow>();
  const totals = { sent: 0, delivered: 0, read: 0, failed: 0 };
  let messagesScanned = 0;
  let cursor: string | null = null;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${META_PROXY_BASE}/${phoneNumberId}/messages`);
    url.searchParams.set("direction", "outbound");
    url.searchParams.set("since", sinceIso);
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (cursor) url.searchParams.set("after", cursor);

    const res = await fetch(url.toString(), { headers: { "X-API-Key": apiKey } });
    if (!res.ok) {
      throw new Error(`Kapso messages API returned ${res.status}`);
    }
    const body = await res.json();
    const messages = (body.data ?? []) as KapsoOutboundMessage[];
    messagesScanned += messages.length;

    for (const msg of messages) {
      if (msg.type !== "template" || !msg.template) continue;
      const name = msg.template.name;
      const row = byTemplate.get(name) ?? {
        templateName: name,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
      };
      // "Sent" is the denominator (every template send attempt).
      // Delivered/Read are cumulative subsets of that funnel (read
      // implies delivered); Failed is the separate terminal state for
      // attempts that never made it — same shape as Kapso's own
      // dashboard (Sent 100%, Delivered/Read/Error as independent %
      // of that base), not mutually-exclusive buckets.
      row.sent++;
      totals.sent++;
      if (msg.kapso.status === "delivered" || msg.kapso.status === "read") {
        row.delivered++;
        totals.delivered++;
      }
      if (msg.kapso.status === "read") {
        row.read++;
        totals.read++;
      }
      if (msg.kapso.status === "failed") {
        row.failed++;
        totals.failed++;
      }
      byTemplate.set(name, row);
    }

    const nextCursor = body.paging?.cursors?.after as string | undefined;
    if (!nextCursor || messages.length < PAGE_SIZE) {
      cursor = null;
      break;
    }
    cursor = nextCursor;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  return {
    totals,
    byTemplate: Array.from(byTemplate.values()).sort((a, b) => b.sent - a.sent),
    messagesScanned,
    truncated,
  };
}

interface KapsoReferral {
  source_type: string;
  source_id: string;
  source_url?: string;
  headline?: string;
  body?: string;
  media_type?: string;
  thumbnail_url?: string;
  video_url?: string;
  image_url?: string;
}

interface KapsoInboundMessage {
  referral?: KapsoReferral;
  kapso: { whatsapp_conversation_id: string };
  timestamp: string;
}

export interface CtwaAdRow {
  sourceId: string;
  headline: string | null;
  body: string | null;
  sourceUrl: string | null;
  mediaType: string | null;
  thumbnailUrl: string | null;
  leads: number;
  firstSeen: string;
  lastSeen: string;
}

export interface CtwaAttribution {
  ads: CtwaAdRow[];
  totalLeads: number;
  messagesScanned: number;
  truncated: boolean;
}

// Meta attaches a `referral` object to the first inbound message of a
// click-to-WhatsApp conversation — there's no separate "ads" endpoint,
// so (same as analytics) this walks inbound messages in range and
// aggregates by ad (referral.source_id). Only source_type "ad" counts
// here — Meta also uses `referral` for organic post/profile clicks,
// which aren't ad spend and don't belong in a CTWA view.
export async function fetchCtwaAttribution(
  phoneNumberId: string,
  sinceIso: string,
): Promise<CtwaAttribution> {
  const apiKey = await kapsoApiKey();
  const byAd = new Map<string, CtwaAdRow>();
  const seenConversations = new Set<string>();
  let messagesScanned = 0;
  let cursor: string | null = null;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${META_PROXY_BASE}/${phoneNumberId}/messages`);
    url.searchParams.set("direction", "inbound");
    url.searchParams.set("since", sinceIso);
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (cursor) url.searchParams.set("after", cursor);

    const res = await fetch(url.toString(), { headers: { "X-API-Key": apiKey } });
    if (!res.ok) {
      throw new Error(`Kapso messages API returned ${res.status}`);
    }
    const body = await res.json();
    const messages = (body.data ?? []) as KapsoInboundMessage[];
    messagesScanned += messages.length;

    for (const msg of messages) {
      const ref = msg.referral;
      if (!ref || ref.source_type !== "ad") continue;
      // A contact can message again later without a fresh referral,
      // but if the same conversation somehow carries >1 referral hit,
      // don't double-count the lead.
      const convId = msg.kapso.whatsapp_conversation_id;
      if (seenConversations.has(convId)) continue;
      seenConversations.add(convId);

      const row = byAd.get(ref.source_id) ?? {
        sourceId: ref.source_id,
        headline: ref.headline ?? null,
        body: ref.body ?? null,
        sourceUrl: ref.source_url ?? null,
        mediaType: ref.media_type ?? null,
        thumbnailUrl: ref.thumbnail_url ?? null,
        leads: 0,
        firstSeen: msg.timestamp,
        lastSeen: msg.timestamp,
      };
      row.leads++;
      if (msg.timestamp < row.firstSeen) row.firstSeen = msg.timestamp;
      if (msg.timestamp > row.lastSeen) row.lastSeen = msg.timestamp;
      byAd.set(ref.source_id, row);
    }

    const nextCursor = body.paging?.cursors?.after as string | undefined;
    if (!nextCursor || messages.length < PAGE_SIZE) {
      cursor = null;
      break;
    }
    cursor = nextCursor;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  return {
    ads: Array.from(byAd.values()).sort((a, b) => b.leads - a.leads),
    totalLeads: seenConversations.size,
    messagesScanned,
    truncated,
  };
}

export async function fetchKapsoTemplates(businessAccountId: string): Promise<KapsoTemplate[]> {
  const apiKey = await kapsoApiKey();
  const res = await fetch(
    `${META_PROXY_BASE}/${businessAccountId}/message_templates?limit=100`,
    { headers: { "X-API-Key": apiKey } },
  );
  if (!res.ok) {
    throw new Error(`Kapso templates API returned ${res.status}`);
  }
  const body = await res.json();
  return (body.data ?? []) as KapsoTemplate[];
}
