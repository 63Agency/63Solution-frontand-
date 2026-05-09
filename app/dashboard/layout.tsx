import { IndustryDashboardShell } from "../../src/components/dashboard/IndustryDashboardShell";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-dvh bg-zinc-950">
      <IndustryDashboardShell>{children}</IndustryDashboardShell>
    </div>
  );
}
