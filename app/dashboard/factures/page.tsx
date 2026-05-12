import { Suspense } from "react";
import { FacturesDevisPage } from "@/src/components/dashboard/FacturesDevisPage";

function FacturesFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6 text-sm text-zinc-500">
      Chargement des devis et factures…
    </div>
  );
}

export default function FacturesRoutePage() {
  return (
    <Suspense fallback={<FacturesFallback />}>
      <FacturesDevisPage />
    </Suspense>
  );
}
