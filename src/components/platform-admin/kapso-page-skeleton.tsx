// ============================================================
// Shared loading.tsx skeleton for the 6 Kapso-backed pages. Next.js
// renders this immediately on navigation (before the async server
// component's data fetch resolves) so a sidebar click feels instant
// even though the page itself is server-rendered with a live Kapso
// call — see loading.tsx in each route folder.
// ============================================================

import { Skeleton } from "@/components/dashboard/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function KapsoPageSkeleton({
  title,
  subtitle,
  variant = "table",
  withRangeSwitcher = false,
}: {
  title: string;
  subtitle: string;
  variant?: "table" | "stat-card";
  withRangeSwitcher?: boolean;
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {withRangeSwitcher ? <Skeleton className="h-9 w-64 rounded-lg" /> : null}
      </div>

      {withRangeSwitcher ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-2 h-7 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {variant === "stat-card" ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
