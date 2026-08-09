import { Suspense } from "react";
import { ParametresPage } from "@/src/components/dashboard/ParametresPage";

export default function DashboardParametresPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
          Chargement…
        </div>
      }
    >
      <ParametresPage />
    </Suspense>
  );
}
