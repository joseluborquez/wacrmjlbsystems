// ============================================================
// Read-only view of this account's WhatsApp Flows (Meta's native
// interactive forms — surveys, booking, lead capture — not to be
// confused with wacrm's own /flows automation builder). No embed
// exists for this section (see kapso-client.ts). Scoped server-side
// to this account's own phone_number_id.
//
// Server component — see phone-numbers/page.tsx for why (no extra
// client -> our API -> Kapso round trip, no "Loading…" flash).
// ============================================================

import { getCurrentAccount } from "@/lib/auth/account";
import { getAccountPhoneNumberId } from "@/lib/platform-admin/kapso-inbox";
import {
  fetchKapsoWhatsappFlows,
  type KapsoWhatsappFlow,
} from "@/lib/platform-admin/kapso-client";
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

function statusVariant(status: string): "default" | "outline" {
  return status === "published" ? "default" : "outline";
}

export default async function WhatsappFlowsPage() {
  const { accountId } = await getCurrentAccount();
  const phoneNumberId = await getAccountPhoneNumberId(accountId);

  let flows: KapsoWhatsappFlow[] | null = null;
  let error: string | null = null;
  if (!phoneNumberId) {
    error = "Kapso isn't configured for this account yet — ask JLB Systems to set it up";
  } else {
    try {
      flows = await fetchKapsoWhatsappFlows(phoneNumberId);
    } catch (err) {
      error = (err as Error).message;
    }
  }

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
          ) : !flows || flows.length === 0 ? (
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
