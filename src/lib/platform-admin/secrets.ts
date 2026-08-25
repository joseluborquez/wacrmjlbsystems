import { supabaseAdmin } from "./admin-client";

/** Thin wrapper over the `leer_secreto` Postgres RPC (Vault reader,
 * service_role only). Returns null if the secret isn't set. */
export async function leerSecreto(name: string): Promise<string | null> {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("leer_secreto", { nombre_secreto: name });
  if (error) {
    console.error(`[leerSecreto] could not read "${name}":`, error);
    return null;
  }
  return (data as string | null) ?? null;
}
