// ============================================================
// Platform super-admin guard — separate from account membership
// on purpose. A platform admin (JLB Systems, the operator) is not
// a member of any client account; the `platform_admins` table and
// the `is_platform_admin()` RPC are a standalone mechanism so this
// never touches the "one account per user" invariant that the rest
// of the app relies on (see migration 017's `idx_accounts_one_per_owner`
// and `redeem_invitation`'s single-membership check).
//
// Read-only by design: nothing here lets the caller act inside a
// client account, only see aggregate data about it.
// ============================================================

import { createClient } from "@/lib/supabase/server";
import { UnauthorizedError, ForbiddenError } from "./account";

export interface PlatformAdminContext {
  userId: string;
}

/**
 * Verifies the caller is authenticated AND listed in `platform_admins`.
 *
 * Throws `UnauthorizedError` if there's no Supabase session, or
 * `ForbiddenError` if the session is valid but the user isn't a
 * platform admin.
 */
export async function requirePlatformAdmin(): Promise<PlatformAdminContext> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    throw new UnauthorizedError();
  }

  const { data: isAdmin, error } = await supabase.rpc("is_platform_admin");
  if (error) {
    console.error("[requirePlatformAdmin] rpc error:", error);
    throw new ForbiddenError("Could not verify platform admin access");
  }
  if (!isAdmin) {
    throw new ForbiddenError("Platform admin access required");
  }

  return { userId: user.id };
}
