import { KapsoPageSkeleton } from "@/components/platform-admin/kapso-page-skeleton";

export default function Loading() {
  return (
    <KapsoPageSkeleton
      title="WhatsApp Flows"
      subtitle="Interactive forms (surveys, booking, lead capture) available on your WhatsApp number via Kapso."
      variant="table"
    />
  );
}
