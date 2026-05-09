"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  loginWithBackend,
  persistAuthSession,
  resolvePostLoginRoute,
} from "../../lib/auth/backend-login";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    if (!isValidEmail(normalizedEmail)) {
      setError("Veuillez entrer un email valide.");
      return;
    }
    if (normalizedPassword.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setLoading(true);

    try {
      const payload = await loginWithBackend(normalizedEmail, normalizedPassword);
      persistAuthSession(payload);
      const route = resolvePostLoginRoute(payload);
      setSuccess("Connexion réussie. Redirection...");
      router.push(route);
      router.refresh();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Erreur réseau ou serveur.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]" />
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/90 p-8 shadow-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-500">
          63 Agency
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Se connecter</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Accédez à votre espace de gestion devis &amp; factures.
        </p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-zinc-300"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={120}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none ring-white/10 transition focus:border-zinc-500 focus:ring-4"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-zinc-300"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              maxLength={128}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none ring-white/10 transition focus:border-zinc-500 focus:ring-4"
              placeholder="********"
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="rounded-lg border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">
              {success}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg border border-zinc-700 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
    </main>
  );
}
