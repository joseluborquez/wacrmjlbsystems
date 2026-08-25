"use client";

// ============================================================
// Embeds Kapso's own inbox (real-time, can reply from here) so this
// account's WhatsApp number — currently managed by Kapso, not by
// wacrm's own whatsapp_config — is viewable without touching the
// live Meta webhook subscription. See PLAN_INBOX_PANEL.md (te ayudo
// app) for the reasoning behind choosing the iframe over rebuilding
// an inbox against Kapso's REST API.
// ============================================================

import { useEffect, useState } from "react";

export default function KapsoInboxPage() {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/kapso-inbox-embed")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: { url: string }) => {
        if (!cancelled) setUrl(data.url);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col space-y-3">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Kapso Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live conversations from the WhatsApp number connected via Kapso. You can
          reply directly from here.
        </p>
      </div>

      {error ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-border bg-card">
          <p className="text-sm text-muted-foreground">
            Could not load the Kapso inbox: {error}
          </p>
        </div>
      ) : !url ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-border bg-card">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      ) : (
        <iframe
          src={url}
          title="Kapso Inbox"
          className="flex-1 rounded-2xl border border-border"
        />
      )}
    </div>
  );
}
