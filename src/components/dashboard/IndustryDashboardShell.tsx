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
  PanelLeft,
  ChevronDown,
  Send,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import {
  canAccessDashboardHref,
  canAccessParametres,
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
  { href: `${FACTURES_BASE}?tab=devis`, label: "Devis" },
  { href: `${FACTURES_BASE}?tab=factures`, label: "Factures" },
  { href: `${FACTURES_BASE}?tab=propositions`, label: "Propositions" },
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

export function IndustryDashboardShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [userRole, setUserRole] = useState("admin");
  const [roleResolved, setRoleResolved] = useState(false);
  const [whatsAppExpanded, setWhatsAppExpanded] = useState(true);
  const [facturesExpanded, setFacturesExpanded] = useState(true);

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

  useEffect(() => {
    // Persist user preference across pages/reloads.
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("dashboard_whatsapp_expanded");
    if (saved === "0") setWhatsAppExpanded(false);
    else if (saved === "1") setWhatsAppExpanded(true);
    else setWhatsAppExpanded(whatsappActive); // default: expanded only when in WhatsApp section
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dashboard_whatsapp_expanded", whatsAppExpanded ? "1" : "0");
  }, [whatsAppExpanded]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("dashboard_factures_expanded");
    if (saved === "0") setFacturesExpanded(false);
    else if (saved === "1") setFacturesExpanded(true);
    else setFacturesExpanded(facturesActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dashboard_factures_expanded", facturesExpanded ? "1" : "0");
  }, [facturesExpanded]);

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

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-zinc-800 text-white"
        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200",
    );

  const subLinkClass = (active: boolean) =>
    cn(
      "flex items-center gap-2.5 rounded-md py-2 pl-9 pr-3 text-[13px] font-medium transition-colors",
      active
        ? "bg-zinc-800 text-white"
        : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-200",
    );

  return (
    <NotificationsProvider>
      <div className="flex h-dvh max-h-dvh overflow-hidden bg-zinc-950 text-zinc-100">
        <aside
          className={cn(
            "flex shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 transition-[width] duration-200",
            collapsed ? "w-[72px]" : "w-64",
          )}
        >
          <div className="flex h-14 items-center border-b border-zinc-800 px-2">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              aria-label={collapsed ? "Agrandir le menu" : "Réduire le menu"}
            >
              <PanelLeft
                className={cn("size-5 transition-transform", collapsed && "rotate-180")}
              />
            </button>
            {!collapsed ? (
              <Link
                href="/dashboard"
                className="ml-1 flex min-w-0 flex-1 items-center"
                aria-label="63 Agency — accueil"
              >
                <Image
                  src="/images/63AgencyTextwhit.png"
                  alt="63 Agency"
                  width={160}
                  height={32}
                  className="h-8 w-auto max-w-full object-contain object-left"
                  priority
                />
              </Link>
            ) : null}
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href} className={linkClass(active)}>
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {!collapsed ? <span>{item.label}</span> : null}
                </Link>
              );
            })}

            {showFactures ? (
              <div className="mt-1">
                {collapsed ? (
                  <Link
                    href={FACTURES_BASE}
                    className={linkClass(facturesActive)}
                    title="Devis, factures & propositions"
                  >
                    <FileText className="size-4 shrink-0" aria-hidden />
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setFacturesExpanded((v) => !v)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors hover:bg-zinc-800/40",
                        facturesActive ? "text-indigo-300" : "text-zinc-300",
                      )}
                      aria-expanded={facturesExpanded}
                      aria-label="Afficher ou masquer Devis, factures & propositions"
                    >
                      <span className="flex items-center gap-3">
                        <FileText className="size-4 shrink-0" aria-hidden />
                        <span>Devis &amp; Factures</span>
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-zinc-500 transition-transform",
                          facturesExpanded ? "rotate-0" : "-rotate-90",
                        )}
                        aria-hidden
                      />
                    </button>

                    {facturesExpanded ? (
                      <ul className="space-y-0.5">
                        {facturesSubItems.map((sub) => {
                          const tab = sub.href.split("tab=")[1] ?? "";
                          const activeTab =
                            tab === "devis"
                              ? (pathname === FACTURES_BASE && !searchParams.get("tab")) ||
                                searchParams.get("tab") === "devis" ||
                                pathname.startsWith(`${FACTURES_BASE}/devis`)
                              : tab === "factures"
                                ? searchParams.get("tab") === "factures" ||
                                  pathname.startsWith(`${FACTURES_BASE}/facture`)
                                : searchParams.get("tab") === "propositions" ||
                                  pathname.startsWith(`${FACTURES_BASE}/proposition`);

                          const subActive = facturesActive && activeTab;

                          return (
                            <li key={sub.href}>
                              <Link href={sub.href} className={subLinkClass(subActive)}>
                                <span
                                  className="size-1.5 shrink-0 rounded-full bg-zinc-700/70"
                                  aria-hidden
                                />
                                {sub.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            {showWhatsApp ? (
              <div className="mt-1">
                {collapsed ? (
                  <Link
                    href={WHATSAPP_BASE}
                    className={linkClass(whatsappActive)}
                    title="WhatsApp"
                  >
                    <MessageCircle className="size-4 shrink-0" aria-hidden />
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setWhatsAppExpanded((v) => !v)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors hover:bg-zinc-800/40",
                        whatsappActive ? "text-emerald-400" : "text-zinc-300",
                      )}
                      aria-expanded={whatsAppExpanded}
                      aria-label="Afficher ou masquer les sous-sections WhatsApp"
                    >
                      <span className="flex items-center gap-3">
                        <MessageCircle className="size-4 shrink-0" aria-hidden />
                        <span>WhatsApp</span>
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-zinc-500 transition-transform",
                          whatsAppExpanded ? "rotate-0" : "-rotate-90",
                        )}
                        aria-hidden
                      />
                    </button>

                    {whatsAppExpanded ? (
                      <ul className="space-y-0.5">
                        {whatsappSubItems.map((sub) => {
                          const SubIcon = sub.icon;
                          const subActive = sub.exact
                            ? pathname === sub.href
                            : pathname === sub.href || pathname.startsWith(`${sub.href}/`);
                          return (
                            <li key={sub.href}>
                              <Link href={sub.href} className={subLinkClass(subActive)}>
                                <SubIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />
                                {sub.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </nav>

          <div className="border-t border-zinc-800 p-2">
            {showParametres ? (
              <Link
                href="/dashboard/parametres"
                className={linkClass(
                  pathname === "/dashboard/parametres" ||
                    pathname.startsWith("/dashboard/parametres/"),
                )}
              >
                <Settings className="size-4 shrink-0" aria-hidden />
                {!collapsed ? <span>Paramètres</span> : null}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            >
              <LogOut className="size-4 shrink-0" aria-hidden />
              {!collapsed ? <span>Déconnexion</span> : null}
            </button>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <DashboardTopBar />
          <main
            className={
              pathname.startsWith("/dashboard/conversations") &&
              !pathname.startsWith("/dashboard/conversations/envoi-multiple")
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
                  className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearAuthSession();
                    window.location.href = "/login";
                  }}
                  className="rounded-md border border-red-700 bg-red-700/80 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
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
