// ============================================================
// Read-only view of this account's own WhatsApp number, sourced live
// from Kapso (no embed exists for this section — see kapso-client.ts
// for why it's a direct REST call instead of an iframe like the
// inbox). Scoped server-side to this account's phone_number_id only.
//
// Server component: fetches during render instead of client-side
// (which meant an extra client -> our API -> Kapso round trip before
// anything painted). No "Loading…" flash — data arrives with the HTML.
// ============================================================

import { Phone } from "lucide-react";
import { getCurrentAccount } from "@/lib/auth/account";
import { getAccountPhoneNumberId } from "@/lib/platform-admin/kapso-inbox";
import { fetchKapsoPhoneNumber, type KapsoPhoneNumber } from "@/lib/platform-admin/kapso-client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function statusVariant(status: string): "default" | "outline" | "destructive" {
  if (status === "CONNECTED") return "default";
  if (status === "GREEN") return "default";
  if (status === "YELLOW") return "outline";
  if (status === "RED") return "destructive";
  return "outline";
}

export default async function PhoneNumbersPage() {
  const { accountId } = await getCurrentAccount();
  const phoneNumberId = await getAccountPhoneNumberId(accountId);

  let number: KapsoPhoneNumber | null = null;
  let error: string | null = null;
  if (!phoneNumberId) {
    error = "Kapso isn't configured for this account yet — ask JLB Systems to set it up";
  } else {
    try {
      number = await fetchKapsoPhoneNumber(phoneNumberId);
    } catch (err) {
      error = (err as Error).message;
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Phone Numbers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The WhatsApp number connected to your account via Kapso.
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Could not load your phone number: {error}
          </CardContent>
        </Card>
      ) : number ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>{number.display_phone_number}</CardTitle>
                <CardDescription>
                  {number.verified_name || number.name}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant={statusVariant(number.status)} className="mt-1">
                {number.status}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Quality rating</p>
              <Badge variant={statusVariant(number.quality_rating)} className="mt-1">
                {number.quality_rating}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Throughput tier</p>
              <p className="mt-1 text-sm font-medium text-foreground">{number.throughput_tier}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Code verification</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {number.code_verification_status}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Inbound messages</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {number.inbound_processing_enabled ? "Enabled" : "Disabled"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Calls</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {number.calls_enabled ? "Enabled" : "Disabled"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
