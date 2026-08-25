import { KapsoPageSkeleton } from "@/components/platform-admin/kapso-page-skeleton";

export default function Loading() {
  return (
    <KapsoPageSkeleton
      title="Ads (CTWA)"
      subtitle="Conversations started from a click-to-WhatsApp ad, grouped by ad."
      variant="table"
      withRangeSwitcher
    />
  );
}
