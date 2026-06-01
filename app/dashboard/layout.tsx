import { Suspense } from "react";
import { IndustryDashboardShell } from "../../src/components/dashboard/IndustryDashboardShell";

function DashboardShellFallback() {
  return (
    <div className="flex h-dvh items-center justify-center bg-zinc-950 text-sm text-zinc-500">
      Chargement…
    </div>
  );
}

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-dvh bg-zinc-950">
      <Suspense fallback={<DashboardShellFallback />}>
        <IndustryDashboardShell>{children}</IndustryDashboardShell>
      </Suspense>
    </div>
  );
}
