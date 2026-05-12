import { Suspense } from "react";
import { NouveauDevisPage } from "@/src/components/dashboard/devis/NouveauDevisPage";

function NouvelleFactureFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6 text-sm text-zinc-500">
      Chargement du formulaire…
    </div>
  );
}

export default function NouvelleFactureRoutePage() {
  return (
    <Suspense fallback={<NouvelleFactureFallback />}>
      <NouveauDevisPage mode="facture" />
    </Suspense>
  );
}
