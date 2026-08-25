"use client";

// ============================================================
// Read-only view of this account's WhatsApp Flows (Meta's native
// interactive forms — surveys, booking, lead capture — not to be
// confused with wacrm's own /flows automation builder). No embed
// exists for this section (see kapso-client.ts). Scoped server-side
// to this account's own phone_number_id.
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

interface KapsoWhatsappFlow {
  id: string;
  name: string;
  status: string;
  json_version: string;
  has_data_endpoint: boolean;
  published_at: string | null;
  created_at: string;
}

function statusVariant(status: string): "default" | "outline" {
  return status === "published" ? "default" : "outline";
}

export default function WhatsappFlowsPage() {
  const [flows, setFlows] = useState<KapsoWhatsappFlow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/kapso/whatsapp-flows")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: { flows: KapsoWhatsappFlow[] }) => {
        if (!cancelled) setFlows(data.flows);
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
        <h1 className="text-2xl font-bold text-foreground">WhatsApp Flows</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Interactive forms (surveys, booking, lead capture) available on your WhatsApp
          number via Kapso.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Could not load your WhatsApp Flows: {error}
            </p>
          ) : !flows ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : flows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No WhatsApp Flows yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>JSON version</TableHead>
                  <TableHead>Data endpoint</TableHead>
                  <TableHead>Published</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flows.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(f.status)}>{f.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{f.json_version}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {f.has_data_endpoint ? "Yes" : "No"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {f.published_at ? new Date(f.published_at).toLocaleDateString() : "—"}
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
