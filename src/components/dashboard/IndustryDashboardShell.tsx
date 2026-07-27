"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  MessagesSquare,
  PanelLeft,
  Send,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import {
  canAccessDashboardHref,
  canViewTeamUsersSection,
  getDefaultDashboardRoute,
  resolveAllowedPages,
} from "@/lib/auth/roles";
import {
  clearAuthSession,
  fetchCurrentUser,
  getStoredUser,
} from "../../../lib/auth/backend-login";
import { fetchMeetingStats } from "@/lib/meetings/backend-meetings";
import { DashboardTopBar } from "./DashboardTopBar";
import { NotificationsProvider } from "./notifications/NotificationsProvider";

const WHATSAPP_BASE = "/dashboard/conversations";
const FACTURES_BASE = "/dashboard/factures";
const PARAMETRES_BASE = "/dashboard/parametres";

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
  { href: "/dashboard/calendrier", label: "Calendrier", icon: Calendar },
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
  const [collapsed, setCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [allowedPages, setAllowedPages] = useState<readonly string[]>([]);
  const [roleResolved, setRoleResolved] = useState(false);
  const [whatsAppExpanded, setWhatsAppExpanded] = useState(true);
  const [facturesExpanded, setFacturesExpanded] = useState(true);
  const [parametresExpanded, setParametresExpanded] = useState(true);
  const [whatsAppMenuOpen, setWhatsAppMenuOpen] = useState(false);
  const [todayMeetingsCount, setTodayMeetingsCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const stored = getStoredUser();
    if (stored?.role) {
      setUserRole(stored.role);
      setAllowedPages(resolveAllowedPages(stored.role, stored.permissions));
    }

    void fetchCurrentUser()
      .then(({ user }) => {
        if (cancelled) return;
        setUserRole(user.role);
        setAllowedPages(resolveAllowedPages(user.role, user.permissions));
        setRoleResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        if (stored?.role) {
          setUserRole(stored.role);
          setAllowedPages(resolveAllowedPages(stored.role, stored.permissions));
        }
        setRoleResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("dashboard_sidebar_collapsed");
    if (saved === "1") setCollapsed(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dashboard_sidebar_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => {
      if (mq.matches) setCollapsed(true);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setWhatsAppMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    if (!roleResolved || !canAccessDashboardHref("/dashboard/calendrier", userRole, allowedPages)) {
      setTodayMeetingsCount(0);
      return;
    }
    void fetchMeetingStats()
      .then((stats) => {
        if (!cancelled) setTodayMeetingsCount(stats.today);
      })
      .catch(() => {
        if (!cancelled) setTodayMeetingsCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, roleResolved, userRole, allowedPages]);

  useEffect(() => {
    if (!whatsAppMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWhatsAppMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [whatsAppMenuOpen]);

  const whatsappActive = isWhatsAppPath(pathname ?? "");
  const facturesActive = isFacturesPath(pathname ?? "");
  const parametresActive = isParametresPath(pathname ?? "");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("dashboard_whatsapp_expanded");
    if (saved === "0") setWhatsAppExpanded(false);
    else if (saved === "1") setWhatsAppExpanded(true);
    else setWhatsAppExpanded(whatsappActive);
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
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("dashboard_parametres_expanded");
    if (saved === "0") setParametresExpanded(false);
    else if (saved === "1") setParametresExpanded(true);
    else setParametresExpanded(parametresActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "dashboard_parametres_expanded",
      parametresExpanded ? "1" : "0",
    );
  }, [parametresExpanded]);

  useEffect(() => {
    if (!roleResolved || !pathname || !userRole) return;
    if (!canAccessDashboardHref(pathname, userRole, allowedPages)) {
      router.replace(getDefaultDashboardRoute(userRole, allowedPages));
    }
  }, [pathname, router, userRole, roleResolved, allowedPages]);

  const homeHref = useMemo(
    () => getDefaultDashboardRoute(userRole, allowedPages),
    [userRole, allowedPages],
  );

  const navItems = useMemo(() => {
    if (!roleResolved) return [];
    return allNavItems.filter((item) =>
      canAccessDashboardHref(item.href, userRole, allowedPages),
    );
  }, [userRole, roleResolved, allowedPages]);

  const showWhatsApp =
    !roleResolved || canAccessDashboardHref(WHATSAPP_BASE, userRole, allowedPages);
  const showFactures =
    !roleResolved || canAccessDashboardHref(FACTURES_BASE, userRole, allowedPages);
  const showParametres =
    !roleResolved || canAccessDashboardHref(PARAMETRES_BASE, userRole, allowedPages);
  const showUsersSub =
    !roleResolved || canViewTeamUsersSection(userRole);

  const visibleParametresSubItems = useMemo(
    () =>
      showUsersSub
        ? parametresSubItems
        : parametresSubItems.filter((item) => item.tab !== "users"),
    [showUsersSub],
  );

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center text-sm font-medium transition-colors",
      collapsed
        ? cn(
            "mx-auto size-10 justify-center rounded-lg",
            active
              ? "bg-zinc-800/60 text-white"
              : "text-zinc-400 hover:bg-zinc-800/35 hover:text-zinc-200 active:bg-zinc-800/50",
          )
        : cn(
            "gap-3 rounded-xl px-3 py-2.5",
            active
              ? "bg-zinc-800/80 text-white"
              : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200",
          ),
    );

  const subLinkClass = (active: boolean) =>
    cn(
      "flex items-center gap-2.5 rounded-xl py-2 pl-9 pr-3 text-[13px] font-medium transition-colors",
      active
        ? "bg-zinc-800/70 text-white"
        : "text-zinc-500 hover:bg-zinc-800/35 hover:text-zinc-200",
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

  const iconSize = collapsed ? "size-6" : "size-5";
  const hideSidebarOnMobileWhatsApp = whatsappActive && !whatsAppMenuOpen;

  return (
    <NotificationsProvider>
      <div className="flex h-dvh max-h-dvh overflow-hidden bg-zinc-950 text-zinc-100 [color-scheme:dark]">
        <aside
          className={cn(
            "relative z-30 flex shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 transition-[width] duration-200",
            collapsed ? "w-[72px]" : "w-64",
            hideSidebarOnMobileWhatsApp && "max-md:hidden",
          )}
        >
          <div
            className={cn(
              "flex h-14 items-center border-b border-zinc-800",
              collapsed ? "justify-center px-0" : "px-2",
            )}
          >
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800/40 hover:text-white active:bg-zinc-800/55"
              aria-label={collapsed ? "Agrandir le menu" : "Réduire le menu"}
            >
              <PanelLeft
                className={cn("size-5 transition-transform duration-200", collapsed && "rotate-180")}
              />
            </button>
            {!collapsed ? (
              <Link
                href={homeHref}
                className="ml-1 flex min-w-0 flex-1 items-center"
                aria-label="63 Agency — accueil"
              >
                <Image
                  src="/images/63.png"
                  alt="63 Agency"
                  width={36}
                  height={36}
                  className="size-9 object-contain"
                  priority
                />
              </Link>
            ) : null}
          </div>

          <nav
            className={cn(
              "app-scroll flex flex-1 flex-col gap-1 overflow-y-auto",
              collapsed ? "px-0 py-2" : "p-2",
            )}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname === item.href ||
                    Boolean(pathname?.startsWith(`${item.href}/`));
              const showTodayBadge =
                item.href === "/dashboard/calendrier" && todayMeetingsCount > 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={
                    collapsed
                      ? showTodayBadge
                        ? `${item.label} (${todayMeetingsCount})`
                        : item.label
                      : undefined
                  }
                  className={cn(linkClass(active), collapsed && "relative")}
                >
                  <Icon className={cn(iconSize, "shrink-0")} strokeWidth={1.75} aria-hidden />
                  {!collapsed ? (
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span>{item.label}</span>
                      {showTodayBadge ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-emerald-300">
                          {todayMeetingsCount > 99 ? "99+" : todayMeetingsCount}
                        </span>
                      ) : null}
                    </span>
                  ) : showTodayBadge ? (
                    <span className="absolute right-1 top-1 size-2 rounded-full bg-emerald-400" />
                  ) : null}
                </Link>
              );
            })}

            {showFactures ? (
              <div className="mt-1">
                {collapsed ? (
                  <Link
                    href={FACTURES_BASE}
                    className={linkClass(facturesActive)}
                    title="Devis & Factures"
                  >
                    <FileText className={cn(iconSize, "shrink-0")} strokeWidth={1.75} aria-hidden />
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setFacturesExpanded((v) => !v)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-zinc-800/40",
                        facturesActive ? "text-indigo-300" : "text-zinc-300",
                      )}
                      aria-expanded={facturesExpanded}
                    >
                      <span className="flex items-center gap-3">
                        <FileText className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
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
                        {facturesSubItems.map((sub) => (
                          <li key={sub.href}>
                            <Link
                              href={sub.href}
                              className={subLinkClass(isFacturesSubActive(sub.tab))}
                            >
                              <span
                                className="size-1.5 shrink-0 rounded-full bg-zinc-600"
                                aria-hidden
                              />
                              {sub.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            {showWhatsApp ? (
              <div className="mt-1">
                {collapsed ? (
                  <button
                    type="button"
                    onClick={() => setWhatsAppMenuOpen((v) => !v)}
                    className={linkClass(whatsappActive || whatsAppMenuOpen)}
                    title="WhatsApp"
                    aria-expanded={whatsAppMenuOpen}
                    aria-label="Menu WhatsApp"
                  >
                    <MessageCircle
                      className={cn(iconSize, "shrink-0")}
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setWhatsAppExpanded((v) => !v)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-zinc-800/40",
                        whatsappActive ? "text-emerald-400" : "text-zinc-300",
                      )}
                      aria-expanded={whatsAppExpanded}
                    >
                      <span className="flex items-center gap-3">
                        <MessageCircle
                          className="size-5 shrink-0"
                          strokeWidth={1.75}
                          aria-hidden
                        />
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
                            : pathname === sub.href ||
                              Boolean(pathname?.startsWith(`${sub.href}/`));
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

          <div className={cn("border-t border-zinc-800", collapsed ? "px-0 py-2" : "p-2")}>
            {showParametres ? (
              collapsed ? (
                <Link
                  href={`${PARAMETRES_BASE}?tab=profil`}
                  className={linkClass(parametresActive)}
                  title="Paramètres"
                >
                  <Settings className={cn(iconSize, "shrink-0")} strokeWidth={1.75} aria-hidden />
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setParametresExpanded((v) => !v)}
                    className={cn(
                      "mb-1 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-zinc-800/40",
                      parametresActive ? "text-zinc-200" : "text-zinc-300",
                    )}
                    aria-expanded={parametresExpanded}
                  >
                    <span className="flex items-center gap-3">
                      <Settings className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
                      <span>Paramètres</span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-zinc-500 transition-transform",
                        parametresExpanded ? "rotate-0" : "-rotate-90",
                      )}
                      aria-hidden
                    />
                  </button>
                  {parametresExpanded ? (
                    <ul className="mb-1 space-y-0.5">
                      {visibleParametresSubItems.map((sub) => {
                        const currentTab = searchParams.get("tab") ?? "profil";
                        const subActive = parametresActive && currentTab === sub.tab;
                        return (
                          <li key={sub.href}>
                            <Link href={sub.href} className={subLinkClass(subActive)}>
                              <span
                                className="size-1.5 shrink-0 rounded-full bg-zinc-600"
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
              )
            ) : null}
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              title={collapsed ? "Déconnexion" : undefined}
              className={cn(
                "flex w-full items-center text-sm font-medium text-zinc-400 transition-colors",
                collapsed
                  ? "mx-auto size-10 justify-center rounded-lg hover:bg-zinc-800/35 hover:text-zinc-200 active:bg-zinc-800/50"
                  : "gap-3 rounded-xl px-3 py-2.5 hover:bg-zinc-800/40 hover:text-zinc-200",
              )}
            >
              <LogOut className={cn(iconSize, "shrink-0")} strokeWidth={1.75} aria-hidden />
              {!collapsed ? <span>Déconnexion</span> : null}
            </button>
          </div>
        </aside>

        {/* WhatsApp secondary menu (collapsed / mobile) */}
        {whatsAppMenuOpen && collapsed ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/50 md:bg-black/40"
              aria-label="Fermer le menu WhatsApp"
              onClick={() => setWhatsAppMenuOpen(false)}
            />
            <aside
              className="fixed inset-y-0 left-[72px] z-50 flex w-[min(280px,calc(100vw-72px))] flex-col border-r border-zinc-800 bg-zinc-950 shadow-2xl"
              role="dialog"
              aria-label="Choisir une section WhatsApp"
            >
              <div className="flex h-14 items-center border-b border-zinc-800 px-4">
                <p className="text-sm font-semibold text-white">WhatsApp</p>
              </div>
              <nav className="flex flex-1 flex-col gap-1 p-3">
                {whatsappSubItems.map((sub) => {
                  const SubIcon = sub.icon;
                  const subActive = sub.exact
                    ? pathname === sub.href
                    : pathname === sub.href ||
                      Boolean(pathname?.startsWith(`${sub.href}/`));
                  return (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      onClick={() => setWhatsAppMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                        subActive
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl",
                          subActive ? "bg-emerald-500/20" : "bg-zinc-800",
                        )}
                      >
                        <SubIcon className="size-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block">{sub.label}</span>
                        <span className="mt-0.5 block text-xs font-normal text-zinc-500">
                          {sub.exact
                            ? "Lire et répondre aux messages"
                            : "Envoyer à plusieurs contacts"}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </>
        ) : null}

        {/* Reopen WhatsApp menu when sidebar is hidden on mobile */}
        {hideSidebarOnMobileWhatsApp ? (
          <button
            type="button"
            onClick={() => setWhatsAppMenuOpen(true)}
            className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 z-40 flex size-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 md:hidden"
            aria-label="Menu WhatsApp"
          >
            <MessageCircle className="size-6" strokeWidth={1.75} aria-hidden />
          </button>
        ) : null}

        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
          {pathname === WHATSAPP_BASE ? null : <DashboardTopBar />}
          <main
            className={
              isWhatsAppPath(pathname ?? "")
                ? "flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-zinc-950"
                : "app-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain bg-zinc-950"
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
