"use client";

// ============================================================
// Read-only view of this account's WhatsApp message templates,
// sourced live from Kapso (no embed exists for this section — see
// kapso-client.ts). Scoped server-side to this account's
// business_account_id only.
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

interface KapsoTemplateComponent {
  type: string;
  text?: string;
}

interface KapsoTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components: KapsoTemplateComponent[];
}

function statusVariant(status: string): "default" | "outline" | "destructive" {
  if (status === "APPROVED") return "default";
  if (status === "PENDING") return "outline";
  if (status === "REJECTED") return "destructive";
  return "outline";
}

function bodyPreview(components: KapsoTemplateComponent[]): string {
  const body = components.find((c) => c.type === "BODY");
  return body?.text ?? "—";
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<KapsoTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/kapso/templates")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: { templates: KapsoTemplate[] }) => {
        if (!cancelled) setTemplates(data.templates);
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
        <h1 className="text-2xl font-bold text-foreground">Templates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          WhatsApp message templates for your number, synced from Meta via Kapso.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Could not load your templates: {error}
            </p>
          ) : !templates ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : templates.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No templates yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Body</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((tpl) => (
                  <TableRow key={tpl.id}>
                    <TableCell className="font-medium">{tpl.name}</TableCell>
                    <TableCell className="text-muted-foreground">{tpl.category}</TableCell>
                    <TableCell className="text-muted-foreground">{tpl.language}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(tpl.status)}>{tpl.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground">
                      {bodyPreview(tpl.components)}
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
