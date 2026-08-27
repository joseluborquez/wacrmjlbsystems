"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { getAccountPhoneNumberId, setAccountKapsoToken } from "@/lib/platform-admin/kapso-inbox";
import { recalculateAudioUsage } from "@/lib/platform-admin/kapso-audio-usage";

export async function saveKapsoInboxTokenAction(formData: FormData): Promise<void> {
  const { userId } = await requirePlatformAdmin();

  const accountId = String(formData.get("accountId") ?? "");
  const token = String(formData.get("token") ?? "").trim();
  const phoneLabel = String(formData.get("phoneLabel") ?? "").trim() || null;
  const phoneNumberId = String(formData.get("phoneNumberId") ?? "").trim() || null;

  if (!accountId || !token) {
    throw new Error("Missing accountId or token");
  }

  await setAccountKapsoToken(accountId, token, phoneLabel, phoneNumberId, userId);
  revalidatePath("/platform-admin");
}

export async function recalculateAudioUsageAction(formData: FormData): Promise<void> {
  const { userId } = await requirePlatformAdmin();

  const accountId = String(formData.get("accountId") ?? "");
  if (!accountId) {
    throw new Error("Missing accountId");
  }

  const phoneNumberId = await getAccountPhoneNumberId(accountId);
  if (!phoneNumberId) {
    throw new Error("This account doesn't have a Kapso phone_number_id configured");
  }

  await recalculateAudioUsage(accountId, phoneNumberId, userId);
  revalidatePath("/platform-admin");
}
