import { Suspense } from "react";
import { NouvellePropositionPage } from "@/src/components/dashboard/proposition/NouvellePropositionPage";

function NouvellePropositionFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6 text-sm text-zinc-500">
      Chargement…
    </div>
  );
}

export default function NouvellePropositionRoutePage() {
  return (
    <Suspense fallback={<NouvellePropositionFallback />}>
      <NouvellePropositionPage />
    </Suspense>
  );
}
