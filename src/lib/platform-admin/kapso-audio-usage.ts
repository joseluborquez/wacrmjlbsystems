// ============================================================
// Measures inbound WhatsApp voice-note audio minutes per account per
// calendar month — the first step toward billing clients for their
// share of JLB Systems' shared Kapso transcription pool. Manually
// triggered (platform-admin "Recalcular" button, see
// src/app/platform-admin/actions.ts), not a cron.
//
// Kapso's messages API exposes no audio duration, so this downloads
// each qualifying voice note's raw .ogg (Opus) file from Kapso's
// public media_url and parses the Ogg container directly to recover
// duration from the Opus granule position — no ffmpeg/ffprobe
// dependency, pure JS. Verified against ffprobe on real Kapso voice
// notes: accurate to within the fixed ~6.5ms Opus codec-delay
// constant, which is not error.
// ============================================================

import { leerSecreto } from "./secrets";
import { supabaseAdmin } from "./admin-client";

const META_PROXY_BASE = "https://api.kapso.ai/meta/whatsapp/v24.0";
const PAGE_SIZE = 100;
// Much higher than the 5-page cap used by fetchCtwaAttribution in
// kapso-client.ts — that cap is fine for an attribution view, but a
// silent truncation would be a real undercount for a number that
// feeds billing.
const MAX_PAGES = 50;
const DOWNLOAD_CONCURRENCY = 8;
// Wall-clock budget for the download+parse phase only (message-list
// pagination is comparatively cheap). Protects against the server
// action hanging indefinitely for an unusually heavy account — see
// computeAudioUsageForAccount for how a budget cutoff is surfaced as
// an honest partial result, not silently dropped.
const DEFAULT_TIME_BUDGET_MS = 45_000;

async function kapsoApiKey(): Promise<string> {
  const apiKey = await leerSecreto("KAPSO_API_KEY");
  if (!apiKey) {
    throw new Error("KAPSO_API_KEY is not set in Vault — cannot call the Kapso API");
  }
  return apiKey;
}

// ------------------------------------------------------------
// Ogg/Opus duration parser
// ------------------------------------------------------------

/** Duration in seconds of an Ogg/Opus file, computed from the
 * container's own granule positions (no ffmpeg needed). Returns null
 * — never throws — for anything that isn't a well-formed Ogg/Opus
 * stream, so one bad file doesn't abort a batch. */
export function oggOpusDurationSeconds(buf: Buffer): number | null {
  const OPUS_RATE = 48000;
  let preSkip: number | null = null;
  let lastGranule: bigint | null = null;
  let offset = 0;

  while (offset < buf.length - 27) {
    if (buf.toString("ascii", offset, offset + 4) !== "OggS") {
      offset++;
      continue;
    }
    const granuleLow = buf.readUInt32LE(offset + 6);
    const granuleHigh = buf.readUInt32LE(offset + 10);
    const granule = BigInt(granuleHigh) * BigInt(4294967296) + BigInt(granuleLow);
    const pageSegments = buf.readUInt8(offset + 26);
    const segmentTable = buf.subarray(offset + 27, offset + 27 + pageSegments);
    const pageBodyLen = segmentTable.reduce((a, b) => a + b, 0);
    const headerLen = 27 + pageSegments;
    const payloadStart = offset + headerLen;

    if (preSkip === null) {
      const magic = buf.toString("ascii", payloadStart, payloadStart + 8);
      if (magic === "OpusHead") preSkip = buf.readUInt16LE(payloadStart + 10);
    }
    if (granule > BigInt(0)) lastGranule = granule;
    offset = payloadStart + pageBodyLen;
  }

  if (lastGranule === null || preSkip === null) return null;
  return Number(lastGranule - BigInt(preSkip)) / OPUS_RATE;
}

// ------------------------------------------------------------
// Calendar-month period
// ------------------------------------------------------------

export interface AudioUsagePeriod {
  start: Date;
  end: Date; // exclusive
}

/** UTC calendar-month boundaries, not per-account timezone —
 * explicit simplification: a voice note sent near local midnight
 * around month-end can land in the "wrong" UTC bucket for a
 * non-UTC client. Acceptable for a first measurement pass. */
export function currentMonthPeriod(now: Date = new Date()): AudioUsagePeriod {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

// ------------------------------------------------------------
// Inbound voice-note message fetch
// ------------------------------------------------------------

interface KapsoAudioMessage {
  type: string;
  audio?: { voice?: boolean; mime_type?: string };
  kapso: { direction: string; media_url?: string; whatsapp_conversation_id: string };
  timestamp: string; // unix seconds, as a string
}

export interface VoiceNoteFetchResult {
  messages: KapsoAudioMessage[];
  truncated: boolean; // hit MAX_PAGES before Kapso ran out of pages
}

/** Only type==="audio" && audio.voice===true counts — a real voice
 * note, not a shared audio-file attachment (WhatsApp/Kapso only
 * transcribes true voice notes). `since` narrows most of the
 * pagination; `period.end` is enforced client-side because Kapso's
 * API has no confirmed `until` param. */
export async function fetchInboundVoiceNotes(
  phoneNumberId: string,
  period: AudioUsagePeriod,
): Promise<VoiceNoteFetchResult> {
  const apiKey = await kapsoApiKey();
  const messages: KapsoAudioMessage[] = [];
  let cursor: string | null = null;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${META_PROXY_BASE}/${phoneNumberId}/messages`);
    url.searchParams.set("direction", "inbound");
    url.searchParams.set("since", period.start.toISOString());
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (cursor) url.searchParams.set("after", cursor);

    const res = await fetch(url.toString(), { headers: { "X-API-Key": apiKey } });
    if (!res.ok) {
      throw new Error(`Kapso messages API returned ${res.status}`);
    }
    const body = await res.json();
    const pageMessages = (body.data ?? []) as KapsoAudioMessage[];

    for (const msg of pageMessages) {
      if (msg.type !== "audio" || msg.audio?.voice !== true) continue;
      const tsMs = Number(msg.timestamp) * 1000;
      if (tsMs < period.start.getTime() || tsMs >= period.end.getTime()) continue;
      if (!msg.kapso.media_url) continue;
      messages.push(msg);
    }

    const nextCursor = body.paging?.cursors?.after as string | undefined;
    if (!nextCursor || pageMessages.length < PAGE_SIZE) {
      cursor = null;
      break;
    }
    cursor = nextCursor;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  return { messages, truncated };
}

// ------------------------------------------------------------
// Simple manual concurrency limiter — no new npm dependency.
// ------------------------------------------------------------

async function mapWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function runOne(): Promise<void> {
    for (let i = next++; i < items.length; i = next++) {
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runOne));
  return results;
}

/** media_url is a Kapso-hosted, publicly-fetchable signed URL — no
 * auth header needed. Returns null (never throws) for a network
 * failure, non-200, or a file that fails to parse as Ogg/Opus — the
 * caller counts this as "skipped", not an aborted batch. */
async function downloadAudioDurationSeconds(mediaUrl: string): Promise<number | null> {
  try {
    const res = await fetch(mediaUrl);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return oggOpusDurationSeconds(buf);
  } catch (err) {
    console.error("[downloadAudioDurationSeconds] failed:", err);
    return null;
  }
}

// ------------------------------------------------------------
// Orchestration
// ------------------------------------------------------------

export interface AudioUsageResult {
  accountId: string;
  periodStart: Date;
  periodEnd: Date;
  totalSeconds: number;
  messageCount: number;
  processedCount: number;
  skippedCount: number;
  truncated: boolean;
}

export async function computeAudioUsageForAccount(
  accountId: string,
  phoneNumberId: string,
  period: AudioUsagePeriod,
  opts: { concurrency?: number; timeBudgetMs?: number } = {},
): Promise<AudioUsageResult> {
  const concurrency = opts.concurrency ?? DOWNLOAD_CONCURRENCY;
  const timeBudgetMs = opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;

  const { messages, truncated: pageTruncated } = await fetchInboundVoiceNotes(
    phoneNumberId,
    period,
  );

  let totalSeconds = 0;
  let processedCount = 0;
  let skippedCount = 0;
  let budgetTruncated = false;
  const deadline = Date.now() + timeBudgetMs;

  // Process in fixed-size concurrency batches so the wall-clock
  // budget can be checked BETWEEN batches.
  const batchSize = concurrency * 4;
  for (let start = 0; start < messages.length; start += batchSize) {
    if (Date.now() > deadline) {
      budgetTruncated = true;
      break;
    }
    const batch = messages.slice(start, start + batchSize);
    const durations = await mapWithConcurrencyLimit(batch, concurrency, (msg) =>
      downloadAudioDurationSeconds(msg.kapso.media_url as string),
    );
    processedCount += batch.length;
    for (const d of durations) {
      if (d === null) skippedCount++;
      else totalSeconds += d;
    }
  }

  return {
    accountId,
    periodStart: period.start,
    periodEnd: period.end,
    totalSeconds,
    messageCount: messages.length,
    processedCount,
    skippedCount,
    truncated: pageTruncated || budgetTruncated,
  };
}

export async function saveAudioUsage(result: AudioUsageResult, computedBy: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("platform_audio_usage").upsert(
    {
      account_id: result.accountId,
      period_start: result.periodStart.toISOString(),
      period_end: result.periodEnd.toISOString(),
      total_seconds: result.totalSeconds,
      message_count: result.messageCount,
      processed_count: result.processedCount,
      skipped_count: result.skippedCount,
      truncated: result.truncated,
      computed_by: computedBy,
      computed_at: new Date().toISOString(),
    },
    { onConflict: "account_id,period_start,period_end" },
  );
  if (error) {
    console.error("[saveAudioUsage] upsert failed:", error);
    throw new Error("Could not save the computed audio usage");
  }
}

/** Entry point used by both the server action and the verification
 * script — no HTTP layer in between. */
export async function recalculateAudioUsage(
  accountId: string,
  phoneNumberId: string,
  computedBy: string,
): Promise<AudioUsageResult> {
  const period = currentMonthPeriod();
  const result = await computeAudioUsageForAccount(accountId, phoneNumberId, period);
  await saveAudioUsage(result, computedBy);
  return result;
}
