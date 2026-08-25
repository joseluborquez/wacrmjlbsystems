"use client";

// ============================================================
// Read-only view of this account's own WhatsApp number, sourced live
// from Kapso (no embed exists for this section — see kapso-client.ts
// for why it's a direct REST call instead of an iframe like the
// inbox). Scoped server-side to this account's phone_number_id only.
// ============================================================

import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface KapsoPhoneNumber {
  display_phone_number: string;
  verified_name: string;
  name: string;
  status: string;
  quality_rating: string;
  throughput_tier: string;
  code_verification_status: string;
  inbound_processing_enabled: boolean;
  calls_enabled: boolean;
}

function statusVariant(status: string): "default" | "outline" | "destructive" {
  if (status === "CONNECTED") return "default";
  if (status === "GREEN") return "default";
  if (status === "YELLOW") return "outline";
  if (status === "RED") return "destructive";
  return "outline";
}

export default function PhoneNumbersPage() {
  const [number, setNumber] = useState<KapsoPhoneNumber | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/kapso/phone-number")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: { number: KapsoPhoneNumber }) => {
        if (!cancelled) setNumber(data.number);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      ) : !number ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Loading…
          </CardContent>
        </Card>
      ) : (
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
      )}
    </div>
  );
}
