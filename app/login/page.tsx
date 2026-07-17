"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
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
  const [rememberMe, setRememberMe] = useState(false);
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
    <main className="relative flex min-h-dvh items-center justify-center overflow-y-auto bg-black px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]" />

      <div className="relative w-full max-w-[360px]">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/images/63AgencyTextwhit.png"
            alt="63 Agency"
            width={180}
            height={42}
            priority
            className="h-auto w-[160px] sm:w-[180px]"
          />
          <h1 className="mt-5 text-xl font-semibold leading-snug tracking-tight text-white sm:text-[22px]">
            Connectez-vous à votre compte
          </h1>
        </div>

        <form onSubmit={handleLogin} className="mt-5 space-y-3.5">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-medium text-zinc-300"
            >
              Adresse email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={120}
              autoComplete="email"
              className="w-full border border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-400"
              placeholder="vous@exemple.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-medium text-zinc-300"
            >
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              maxLength={128}
              autoComplete="current-password"
              className="w-full border border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-400"
              placeholder="********"
            />
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            <label className="flex cursor-pointer items-center gap-2 text-zinc-300">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="size-3.5 border-zinc-600 bg-transparent accent-white"
              />
              Souvenez-vous de moi
            </label>
            <button
              type="button"
              className="shrink-0 text-zinc-400 transition hover:text-white"
            >
              Mot de passe oublié ?
            </button>
          </div>

          {error ? (
            <p className="border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
              {success}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full border border-white bg-white px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-zinc-900 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Ou
          </span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        <button
          type="button"
          className="mt-4 flex w-full items-center justify-center gap-2.5 border border-zinc-700 bg-transparent px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-zinc-100 transition hover:border-zinc-500 hover:bg-white/5"
        >
          <GoogleIcon />
          Continuer avec Google
        </button>

        <p className="mt-5 text-center text-xs text-zinc-400">
          Pas encore de compte ?{" "}
          <button
            type="button"
            className="font-semibold text-white transition hover:underline"
          >
            Créez votre compte
          </button>
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}
