"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  MessagesSquare,
  Send,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import {
  canAccessDashboardHref,
  canAccessParametres,
  canViewTeamUsersSection,
  getDefaultDashboardRoute,
} from "@/lib/auth/roles";
import {
  clearAuthSession,
  fetchCurrentUser,
  getStoredUser,
} from "../../../lib/auth/backend-login";
import { DashboardTopBar } from "./DashboardTopBar";
import { NotificationsProvider } from "./notifications/NotificationsProvider";

const WHATSAPP_BASE = "/dashboard/conversations";
const FACTURES_BASE = "/dashboard/factures";
const PARAMETRES_BASE = "/dashboard/parametres";

type SectionKey = "factures" | "whatsapp" | "parametres" | null;

const parametresSubItems = [
  { href: `${PARAMETRES_BASE}?tab=profil`, label: "Profil", tab: "profil" },
  { href: `${PARAMETRES_BASE}?tab=password`, label: "Sécurité", tab: "password" },
  { href: `${PARAMETRES_BASE}?tab=users`, label: "Gestion acc équipe", tab: "users" },
] as const;

const whatsappSubItems = [
  { href: WHATSAPP_BASE, label: "Conversations", icon: MessagesSquare, exact: true },
  {
    href: `${WHATSAPP_BASE}/envoi-multiple`,
    label: "Envoi multiple",
    icon: Send,
    exact: false,
  },
] as const;

const facturesSubItems = [
  { href: `${FACTURES_BASE}?tab=devis`, label: "Devis", tab: "devis" },
  { href: `${FACTURES_BASE}?tab=factures`, label: "Factures", tab: "factures" },
  { href: `${FACTURES_BASE}?tab=propositions`, label: "Propositions", tab: "propositions" },
] as const;

const allNavItems = [
  { href: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
  { href: "/dashboard/leads", label: "Leads", icon: UserPlus },
] as const;

function isWhatsAppPath(pathname: string): boolean {
  return pathname === WHATSAPP_BASE || pathname.startsWith(`${WHATSAPP_BASE}/`);
}

function isFacturesPath(pathname: string): boolean {
  return pathname === FACTURES_BASE || pathname.startsWith(`${FACTURES_BASE}/`);
}

function isParametresPath(pathname: string): boolean {
  return pathname === PARAMETRES_BASE || pathname.startsWith(`${PARAMETRES_BASE}/`);
}

export function IndustryDashboardShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [userRole, setUserRole] = useState("admin");
  const [roleResolved, setRoleResolved] = useState(false);
  const [openSection, setOpenSection] = useState<SectionKey>(null);

  useEffect(() => {
    let cancelled = false;
    const stored = getStoredUser();
    if (stored?.role) setUserRole(stored.role);
    setRoleResolved(true);

    void fetchCurrentUser()
      .then(({ user }) => {
        if (!cancelled) setUserRole(user.role);
      })
      .catch(() => {
        if (!cancelled && stored?.role) setUserRole(stored.role);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const whatsappActive = isWhatsAppPath(pathname ?? "");
  const facturesActive = isFacturesPath(pathname ?? "");
  const parametresActive = isParametresPath(pathname ?? "");

  useEffect(() => {
    if (facturesActive) setOpenSection("factures");
    else if (whatsappActive) setOpenSection("whatsapp");
    else if (parametresActive) setOpenSection("parametres");
    else setOpenSection(null);
  }, [facturesActive, whatsappActive, parametresActive]);

  useEffect(() => {
    if (!roleResolved || !pathname) return;
    if (!canAccessDashboardHref(pathname, userRole)) {
      router.replace(getDefaultDashboardRoute(userRole));
    }
  }, [pathname, router, userRole, roleResolved]);

  const navItems = useMemo(() => {
    if (!roleResolved) return [...allNavItems];
    return allNavItems.filter((item) => canAccessDashboardHref(item.href, userRole));
  }, [userRole, roleResolved]);

  const showWhatsApp = !roleResolved || canAccessDashboardHref(WHATSAPP_BASE, userRole);
  const showFactures = !roleResolved || canAccessDashboardHref(FACTURES_BASE, userRole);
  const showParametres = !roleResolved || canAccessParametres(userRole);
  const showUsersSub =
    !roleResolved || canViewTeamUsersSection(userRole);

  const visibleParametresSubItems = useMemo(
    () =>
      showUsersSub
        ? parametresSubItems
        : parametresSubItems.filter((item) => item.tab !== "users"),
    [showUsersSub],
  );

  const iconBtnClass = (active: boolean) =>
    cn(
      "flex size-11 items-center justify-center rounded-xl transition-colors",
      active
        ? "bg-zinc-800 text-white"
        : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100",
    );

  const subLinkClass = (active: boolean) =>
    cn(
      "block rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors",
      active
        ? "bg-zinc-800 text-white"
        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100",
    );

  const isFacturesSubActive = (tab: string) => {
    if (!facturesActive) return false;
    if (tab === "devis") {
      return (
        (pathname === FACTURES_BASE && !searchParams.get("tab")) ||
        searchParams.get("tab") === "devis" ||
        Boolean(pathname?.startsWith(`${FACTURES_BASE}/devis`))
      );
    }
    if (tab === "factures") {
      return (
        searchParams.get("tab") === "factures" ||
        Boolean(pathname?.startsWith(`${FACTURES_BASE}/facture`))
      );
    }
    return (
      searchParams.get("tab") === "propositions" ||
      Boolean(pathname?.startsWith(`${FACTURES_BASE}/proposition`))
    );
  };

  const sectionTitle =
    openSection === "factures"
      ? "Devis & Factures"
      : openSection === "whatsapp"
        ? "WhatsApp"
        : openSection === "parametres"
          ? "Configuration"
          : null;

  return (
    <NotificationsProvider>
      <div className="flex h-dvh max-h-dvh overflow-hidden bg-zinc-950 text-zinc-100">
        {/* Primary icon rail */}
        <aside className="flex w-[72px] shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
          <div className="flex h-14 items-center justify-center border-b border-zinc-800">
            <Link href="/dashboard" aria-label="63 Agency — accueil" className="p-1">
              <Image
                src="/images/63.png"
                alt="63"
                width={36}
                height={36}
                className="size-9 object-contain"
                priority
              />
            </Link>
          </div>

          <nav className="flex flex-1 flex-col items-center gap-2 overflow-y-auto py-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname === item.href ||
                    Boolean(pathname?.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-label={item.label}
                  onClick={() => setOpenSection(null)}
                  className={iconBtnClass(active)}
                >
                  <Icon className="size-6" strokeWidth={1.75} aria-hidden />
                </Link>
              );
            })}

            {showFactures ? (
              <button
                type="button"
                title="Devis & Factures"
                aria-label="Devis & Factures"
                aria-pressed={openSection === "factures"}
                onClick={() => {
                  setOpenSection((prev) => (prev === "factures" ? null : "factures"));
                  if (!facturesActive) router.push(FACTURES_BASE);
                }}
                className={iconBtnClass(facturesActive || openSection === "factures")}
              >
                <FileText className="size-6" strokeWidth={1.75} aria-hidden />
              </button>
            ) : null}

            {showWhatsApp ? (
              <button
                type="button"
                title="WhatsApp"
                aria-label="WhatsApp"
                aria-pressed={openSection === "whatsapp"}
                onClick={() => {
                  setOpenSection((prev) => (prev === "whatsapp" ? null : "whatsapp"));
                  if (!whatsappActive) router.push(WHATSAPP_BASE);
                }}
                className={iconBtnClass(whatsappActive || openSection === "whatsapp")}
              >
                <MessageCircle className="size-6" strokeWidth={1.75} aria-hidden />
              </button>
            ) : null}
          </nav>

          <div className="flex flex-col items-center gap-2 border-t border-zinc-800 py-3">
            {showParametres ? (
              <button
                type="button"
                title="Paramètres"
                aria-label="Paramètres"
                aria-pressed={openSection === "parametres"}
                onClick={() => {
                  setOpenSection((prev) => (prev === "parametres" ? null : "parametres"));
                  if (!parametresActive) router.push(`${PARAMETRES_BASE}?tab=profil`);
                }}
                className={iconBtnClass(parametresActive || openSection === "parametres")}
              >
                <Settings className="size-6" strokeWidth={1.75} aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              title="Déconnexion"
              aria-label="Déconnexion"
              onClick={() => setShowLogoutConfirm(true)}
              className={iconBtnClass(false)}
            >
              <LogOut className="size-6" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </aside>

        {/* Secondary section panel */}
        {openSection && sectionTitle ? (
          <aside className="flex w-[240px] shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
            <div className="flex h-14 items-center border-b border-zinc-800 px-5">
              <h2 className="text-lg font-semibold tracking-tight text-white">
                {sectionTitle}
              </h2>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              {openSection === "factures" ? (
                <ul className="space-y-0.5">
                  {facturesSubItems.map((sub) => (
                    <li key={sub.href}>
                      <Link
                        href={sub.href}
                        className={subLinkClass(isFacturesSubActive(sub.tab))}
                      >
                        {sub.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}

              {openSection === "whatsapp" ? (
                <ul className="space-y-0.5">
                  {whatsappSubItems.map((sub) => {
                    const subActive = sub.exact
                      ? pathname === sub.href
                      : pathname === sub.href ||
                        Boolean(pathname?.startsWith(`${sub.href}/`));
                    return (
                      <li key={sub.href}>
                        <Link href={sub.href} className={subLinkClass(subActive)}>
                          {sub.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {openSection === "parametres" ? (
                <ul className="space-y-0.5">
                  {visibleParametresSubItems.map((sub) => {
                    const currentTab = searchParams.get("tab") ?? "profil";
                    const subActive = parametresActive && currentTab === sub.tab;
                    return (
                      <li key={sub.href}>
                        <Link href={sub.href} className={subLinkClass(subActive)}>
                          {sub.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </nav>
          </aside>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {pathname === WHATSAPP_BASE ? null : <DashboardTopBar />}
          <main
            className={
              pathname === WHATSAPP_BASE
                ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-950"
                : "min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-zinc-950"
            }
          >
            {children}
          </main>
        </div>

        {showLogoutConfirm ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
              <h3 className="text-lg font-semibold text-white">Confirmer la déconnexion</h3>
              <p className="mt-2 text-sm text-zinc-300">
                Voulez-vous vraiment vous déconnecter maintenant ?
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="border border-zinc-700 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-zinc-200 transition hover:bg-zinc-800"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearAuthSession();
                    window.location.href = "/login";
                  }}
                  className="border border-red-700 bg-red-700/80 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-white transition hover:bg-red-600"
                >
                  Se déconnecter
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </NotificationsProvider>
  );
}
