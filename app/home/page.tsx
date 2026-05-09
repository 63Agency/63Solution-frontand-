import Link from "next/link";

export default function HomeAppPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 px-4 dark:bg-black">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Bienvenue
      </h1>
      <p className="max-w-md text-center text-sm text-zinc-600 dark:text-zinc-400">
        Tu es connecté avec un compte standard. L&apos;espace admin est réservé
        aux rôles <strong>admin</strong>.
      </p>
      <Link
        href="/login"
        className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
      >
        Retour login
      </Link>
    </main>
  );
}
