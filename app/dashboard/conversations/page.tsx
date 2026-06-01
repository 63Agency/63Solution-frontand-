import { Suspense } from "react";
import { ConversationsPage } from "@/src/components/dashboard/whatsapp/ConversationsPage";

export default function DashboardConversationsPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-zinc-500">Chargement…</div>}>
      <ConversationsPage />
    </Suspense>
  );
}
