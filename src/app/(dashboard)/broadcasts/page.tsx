// ============================================================
// Read-only view of this account's WhatsApp broadcast campaigns,
// sourced live from Kapso (no embed exists for this section — see
// kapso-client.ts). Replaces wacrm's native broadcast feature, which
// isn't wired to a real WhatsApp connection here (Kapso is the actual
// sending engine) — same treatment as Inbox -> Kapso Inbox. The
// native /broadcasts/new and /broadcasts/[id] routes and their data
// still exist, just unlinked from here.
//
// Server component — see phone-numbers/page.tsx for why (no extra
// client -> our API -> Kapso round trip, no "Loading…" flash).
// ============================================================

import { getCurrentAccount } from "@/lib/auth/account";
import { getAccountPhoneNumberId } from "@/lib/platform-admin/kapso-inbox";
import { fetchKapsoBroadcasts, type KapsoBroadcast } from "@/lib/platform-admin/kapso-client";
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

function statusVariant(status: string): "default" | "outline" | "destructive" {
  if (status === "completed") return "default";
  if (status === "sending" || status === "draft") return "outline";
  if (status === "failed") return "destructive";
  return "outline";
}

export default async function BroadcastsPage() {
  const { accountId } = await getCurrentAccount();
  const phoneNumberId = await getAccountPhoneNumberId(accountId);

  let broadcasts: KapsoBroadcast[] | null = null;
  let error: string | null = null;
  if (!phoneNumberId) {
    error = "Kapso isn't configured for this account yet — ask JLB Systems to set it up";
  } else {
    try {
      broadcasts = await fetchKapsoBroadcasts(phoneNumberId);
    } catch (err) {
      error = (err as Error).message;
    }
  }

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
          ) : !broadcasts || broadcasts.length === 0 ? (
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
