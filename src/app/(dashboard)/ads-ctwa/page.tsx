"use client";

// ============================================================
// Click-to-WhatsApp (CTWA) ad attribution. Kapso has no dedicated ads
// endpoint (same gap as Analytics) — Meta attaches a `referral` object
// to the first inbound message of a conversation that started from an
// ad click, so this walks inbound messages in range and aggregates by
// ad (referral.source_id). See kapso-client.ts.
// ============================================================

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CtwaAdRow {
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

interface CtwaAttribution {
  ads: CtwaAdRow[];
  totalLeads: number;
  messagesScanned: number;
  truncated: boolean;
}

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All time" },
] as const;

function unixToDate(ts: string): string {
  return new Date(Number(ts) * 1000).toLocaleDateString();
}

interface FetchState {
  range: string;
  data: CtwaAttribution | null;
  error: string | null;
}

export default function AdsCtwaPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("30");
  const [result, setResult] = useState<FetchState>({ range: "30", data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/kapso/ads-ctwa?range=${range}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((body: CtwaAttribution) => {
        if (!cancelled) setResult({ range, data: body, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setResult({ range, data: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const loading = result.range !== range;
  const data = loading ? null : result.data;
  const error = loading ? null : result.error;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ads (CTWA)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Conversations started from a click-to-WhatsApp ad, grouped by ad — computed
            from the referral data Meta attaches to the first message of each chat.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {RANGES.map((r) => (
            <Button
              key={r.value}
              type="button"
              size="sm"
              variant="ghost"
              className={cn(range === r.value && "bg-muted")}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Could not load ad attribution: {error}
          </CardContent>
        </Card>
      ) : !data ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Loading…
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Leads from ads</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{data.totalLeads}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Ads driving traffic</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{data.ads.length}</p>
              </CardContent>
            </Card>
          </div>
          {data.truncated ? (
            <p className="text-xs text-muted-foreground">
              Showing the most recent {data.messagesScanned} inbound messages in range —
              there may be more.
            </p>
          ) : null}

          <Card>
            <CardContent className="p-0">
              {data.ads.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  No conversations from ads in this range.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ad</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead>First seen</TableHead>
                      <TableHead>Last seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.ads.map((ad) => (
                      <TableRow key={ad.sourceId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {ad.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element -- remote Meta CDN thumbnail, not worth Next/Image config for a small preview
                              <img
                                src={ad.thumbnailUrl}
                                alt=""
                                className="h-10 w-10 shrink-0 rounded-md object-cover"
                              />
                            ) : null}
                            <div>
                              <p className="font-medium text-foreground">
                                {ad.headline || ad.sourceId}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {ad.sourceId}
                                {ad.mediaType ? ` · ${ad.mediaType}` : ""}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{ad.leads}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {unixToDate(ad.firstSeen)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {unixToDate(ad.lastSeen)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
