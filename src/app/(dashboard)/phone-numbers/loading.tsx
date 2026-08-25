import { KapsoPageSkeleton } from "@/components/platform-admin/kapso-page-skeleton";

export default function Loading() {
  return (
    <KapsoPageSkeleton
      title="Phone Numbers"
      subtitle="The WhatsApp number connected to your account via Kapso."
      variant="stat-card"
    />
  );
}
