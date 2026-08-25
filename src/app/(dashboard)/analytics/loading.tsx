import { KapsoPageSkeleton } from "@/components/platform-admin/kapso-page-skeleton";

export default function Loading() {
  return (
    <KapsoPageSkeleton
      title="Analytics"
      subtitle="Outbound template message and broadcast performance, computed from Kapso message data."
      variant="table"
      withRangeSwitcher
    />
  );
}
