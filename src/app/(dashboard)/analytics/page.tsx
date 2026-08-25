"use client";

// ============================================================
// Kapso has no dedicated analytics endpoint (unlike phone numbers /
// templates / broadcasts / flows) — this aggregates it ourselves from
// outbound template messages + broadcast campaigns, scoped to this
// account's own phone_number_id. Approximates Kapso's own Analytics
// tab (Sent/Delivered/Read/Failed, per-template breakdown) but is
// computed here, not fetched pre-aggregated — see kapso-client.ts.
// ============================================================

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface TemplateStatRow {
  templateName: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

interface AnalyticsResponse {
  templateAnalytics: {
    totals: { sent: number; delivered: number; read: number; failed: number };
    byTemplate: TemplateStatRow[];
    messagesScanned: number;
    truncated: boolean;
  };
  broadcastSummary: {
    campaigns: number;
    recipients: number;
    sent: number;
    delivered: number;
    failed: number;
  };
}

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All time" },
] as const;

function percent(numerator: number, denominator: number): string {
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

interface FetchState {
  range: string;
  data: AnalyticsResponse | null;
  error: string | null;
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("30");
  // Tags each result with the range it answers, so "loading" is
  // derived (result.range !== range) instead of an imperative reset
  // at the top of the effect — avoids a synchronous setState call in
  // the effect body while still showing a fresh loading state on
  // every range switch.
  const [result, setResult] = useState<FetchState>({ range: "30", data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/kapso/analytics?range=${range}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((body: AnalyticsResponse) => {
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
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Outbound template message and broadcast performance, computed from Kapso
            message data (Kapso has no built-in analytics API to pull this pre-aggregated).
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
            Could not load analytics: {error}
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
          <div>
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              Template messages
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Sent" value={data.templateAnalytics.totals.sent} />
              <StatCard
                label="Delivered"
                value={data.templateAnalytics.totals.delivered}
                hint={percent(
                  data.templateAnalytics.totals.delivered,
                  data.templateAnalytics.totals.sent,
                )}
              />
              <StatCard
                label="Read"
                value={data.templateAnalytics.totals.read}
                hint={percent(
                  data.templateAnalytics.totals.read,
                  data.templateAnalytics.totals.sent,
                )}
              />
              <StatCard
                label="Failed"
                value={data.templateAnalytics.totals.failed}
                hint={percent(
                  data.templateAnalytics.totals.failed,
                  data.templateAnalytics.totals.sent,
                )}
              />
            </div>
            {data.templateAnalytics.truncated ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Showing the most recent {data.templateAnalytics.messagesScanned} messages
                in range — there may be more.
              </p>
            ) : null}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Breakdown by template</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.templateAnalytics.byTemplate.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  No template messages sent in this range.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead className="text-right">Sent</TableHead>
                      <TableHead className="text-right">Delivered</TableHead>
                      <TableHead className="text-right">Read</TableHead>
                      <TableHead className="text-right">Failed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.templateAnalytics.byTemplate.map((row) => (
                      <TableRow key={row.templateName}>
                        <TableCell className="font-medium">{row.templateName}</TableCell>
                        <TableCell className="text-right">{row.sent}</TableCell>
                        <TableCell className="text-right">{row.delivered}</TableCell>
                        <TableCell className="text-right">{row.read}</TableCell>
                        <TableCell className="text-right">{row.failed}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-foreground">Broadcasts</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Campaigns" value={data.broadcastSummary.campaigns} />
              <StatCard label="Recipients" value={data.broadcastSummary.recipients} />
              <StatCard label="Sent" value={data.broadcastSummary.sent} />
              <StatCard
                label="Delivered"
                value={data.broadcastSummary.delivered}
                hint={percent(data.broadcastSummary.delivered, data.broadcastSummary.sent)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
