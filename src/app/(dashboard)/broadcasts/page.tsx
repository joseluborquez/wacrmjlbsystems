"use client";

// ============================================================
// Read-only view of this account's WhatsApp broadcast campaigns,
// sourced live from Kapso (no embed exists for this section — see
// kapso-client.ts). Replaces wacrm's native broadcast feature, which
// isn't wired to a real WhatsApp connection here (Kapso is the actual
// sending engine) — same treatment as Inbox -> Kapso Inbox. The
// native /broadcasts/new and /broadcasts/[id] routes and their data
// still exist, just unlinked from here.
// ============================================================

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface KapsoBroadcast {
  id: string;
  name: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  delivered_count: number;
  response_rate: number | null;
  created_at: string;
}

function statusVariant(status: string): "default" | "outline" | "destructive" {
  if (status === "completed") return "default";
  if (status === "sending" || status === "draft") return "outline";
  if (status === "failed") return "destructive";
  return "outline";
}

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<KapsoBroadcast[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/kapso/broadcasts")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: { broadcasts: KapsoBroadcast[] }) => {
        if (!cancelled) setBroadcasts(data.broadcasts);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Broadcasts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Broadcast campaigns sent from your WhatsApp number via Kapso.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Could not load your broadcasts: {error}
            </p>
          ) : !broadcasts ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : broadcasts.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No broadcasts yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Recipients</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="text-right">Response rate</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {broadcasts.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(b.status)}>{b.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{b.total_recipients}</TableCell>
                    <TableCell className="text-right">{b.sent_count}</TableCell>
                    <TableCell className="text-right">{b.delivered_count}</TableCell>
                    <TableCell className="text-right">{b.failed_count}</TableCell>
                    <TableCell className="text-right">
                      {b.response_rate != null ? `${b.response_rate}%` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(b.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
