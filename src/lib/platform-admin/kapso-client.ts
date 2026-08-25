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
