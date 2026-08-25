// ============================================================
// Read-only view of this account's WhatsApp message templates,
// sourced live from Kapso (no embed exists for this section — see
// kapso-client.ts). Scoped server-side to this account's
// business_account_id only.
//
// Server component — see phone-numbers/page.tsx for why (no extra
// client -> our API -> Kapso round trip, no "Loading…" flash).
// ============================================================

import { getCurrentAccount } from "@/lib/auth/account";
import { getAccountPhoneNumberId } from "@/lib/platform-admin/kapso-inbox";
import {
  fetchKapsoPhoneNumber,
  fetchKapsoTemplates,
  type KapsoTemplate,
  type KapsoTemplateComponent,
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

export default async function TemplatesPage() {
  const { accountId } = await getCurrentAccount();
  const phoneNumberId = await getAccountPhoneNumberId(accountId);

  let templates: KapsoTemplate[] | null = null;
  let error: string | null = null;
  if (!phoneNumberId) {
    error = "Kapso isn't configured for this account yet — ask JLB Systems to set it up";
  } else {
    try {
      // Templates are looked up per business_account_id, not per
      // phone_number_id — fetch the number first to resolve it.
      const number = await fetchKapsoPhoneNumber(phoneNumberId);
      templates = await fetchKapsoTemplates(number.business_account_id);
    } catch (err) {
      error = (err as Error).message;
    }
  }

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
          ) : !templates || templates.length === 0 ? (
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
