import { KapsoPageSkeleton } from "@/components/platform-admin/kapso-page-skeleton";

export default function Loading() {
  return (
    <KapsoPageSkeleton
      title="Broadcasts"
      subtitle="Broadcast campaigns sent from your WhatsApp number via Kapso."
      variant="table"
    />
  );
}
