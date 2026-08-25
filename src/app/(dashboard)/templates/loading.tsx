import { KapsoPageSkeleton } from "@/components/platform-admin/kapso-page-skeleton";

export default function Loading() {
  return (
    <KapsoPageSkeleton
      title="Templates"
      subtitle="WhatsApp message templates for your number, synced from Meta via Kapso."
      variant="table"
    />
  );
}
