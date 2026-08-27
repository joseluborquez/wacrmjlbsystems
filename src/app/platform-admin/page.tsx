// ============================================================
// Platform super-admin panel (JLB Systems) — read-only overview of
// every client account, plus the one write action platform admin
// actually needs to do by hand: pasting in a client's Kapso inbox
// embed token (see src/lib/platform-admin/kapso-inbox.ts for why this
// can't be self-service — it requires the Kapso project API key).
//
// Intentionally outside the (dashboard) route group: it isn't scoped
// to any single account, so it doesn't belong under the sidebar shell
// that every account-scoped page shares.
//
// No account can act "as" another here — see src/lib/auth/
// platform-admin.ts for why that scope was deliberately left out.
// ============================================================

import { Fragment } from "react";
import { redirect } from "next/navigation";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { loadCurrentMonthAudioUsage, loadPlatformAccounts } from "@/lib/platform-admin/queries";
import { listAccountsForPipelineSync, listAccountsWithKapsoToken } from "@/lib/platform-admin/kapso-inbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { recalculateAudioUsageAction, saveKapsoInboxTokenAction } from "./actions";

export default async function PlatformAdminPage() {
  try {
    await requirePlatformAdmin();
  } catch {
    redirect("/dashboard");
  }

  const [accounts, accountsWithKapso, audioUsageByAccount, kapsoEligible] = await Promise.all([
    loadPlatformAccounts(),
    listAccountsWithKapsoToken(),
    loadCurrentMonthAudioUsage(),
    listAccountsForPipelineSync(),
  ]);
  const eligibleForAudioUsage = new Set(kapsoEligible.map((c) => c.accountId));

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cuentas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Panel de solo lectura para JLB Systems. No permite entrar a ninguna
          cuenta ni actuar en su nombre — solo ver el panorama general y
          configurar el inbox de Kapso de cada cliente.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {accounts.length} cuenta{accounts.length === 1 ? "" : "s"}
          </CardTitle>
          <CardDescription>Ordenadas por fecha de alta, más reciente primero.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuenta</TableHead>
                <TableHead>Dueño</TableHead>
                <TableHead>Alta</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead className="text-right">Contactos</TableHead>
                <TableHead className="text-right">Conversaciones</TableHead>
                <TableHead className="text-right">Mensajes (30d)</TableHead>
                <TableHead className="text-right">Audio voz (mes)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => {
                const hasKapsoToken = accountsWithKapso.has(a.id);
                const audioUsage = audioUsageByAccount.get(a.id);
                const canRecalculateAudio = eligibleForAudioUsage.has(a.id);
                return (
                  <Fragment key={a.id}>
                    <TableRow>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.ownerEmail ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(a.createdAt).toLocaleDateString("es-CL")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={a.whatsappStatus === "connected" ? "default" : "outline"}>
                          {a.whatsappStatus === "connected"
                            ? "Conectado"
                            : a.whatsappStatus === "disconnected"
                              ? "Desconectado"
                              : "Sin configurar"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {a.contactsCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {a.conversationsCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {a.messagesLast30d.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {!canRecalculateAudio ? (
                          <span className="text-xs text-muted-foreground">Sin Kapso</span>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            {audioUsage ? (
                              <>
                                <span className="font-medium">
                                  {audioUsage.totalMinutes.toFixed(1)} min
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {audioUsage.processedCount - audioUsage.skippedCount} de{" "}
                                  {audioUsage.messageCount} notas
                                  {audioUsage.skippedCount > 0 &&
                                    ` · ${audioUsage.skippedCount} omitidas`}
                                </span>
                                {audioUsage.truncated && (
                                  <Badge variant="secondary">Parcial</Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {new Date(audioUsage.computedAt).toLocaleString("es-CL")}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sin calcular</span>
                            )}
                            <form action={recalculateAudioUsageAction}>
                              <input type="hidden" name="accountId" value={a.id} />
                              <Button type="submit" size="sm" variant="outline">
                                Recalcular
                              </Button>
                            </form>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={8} className="bg-muted/30 py-3">
                        <form action={saveKapsoInboxTokenAction} className="flex items-end gap-2">
                          <input type="hidden" name="accountId" value={a.id} />
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Kapso Inbox:</span>
                            {hasKapsoToken ? (
                              <Badge variant="default">Configurado</Badge>
                            ) : (
                              <Badge variant="outline">Sin configurar</Badge>
                            )}
                          </div>
                          <Input
                            name="phoneLabel"
                            placeholder="Etiqueta (ej: +56 9 8525 8411)"
                            className="h-8 max-w-52 text-xs"
                          />
                          <Input
                            name="phoneNumberId"
                            placeholder="phone_number_id de Kapso"
                            className="h-8 max-w-52 text-xs"
                          />
                          <Input
                            name="token"
                            type="password"
                            placeholder={
                              hasKapsoToken
                                ? "Pegar token nuevo para reemplazarlo"
                                : "Pegar el token del inbox_embed de Kapso"
                            }
                            className="h-8 max-w-80 text-xs"
                          />
                          <Button type="submit" size="sm" variant="outline">
                            {hasKapsoToken ? "Actualizar" : "Guardar"}
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })}
              {accounts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Todavía no hay cuentas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
