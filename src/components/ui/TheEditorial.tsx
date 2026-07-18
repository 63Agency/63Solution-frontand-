"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    ArrowUpRight,
    FileText,
    LayoutDashboard,
    PieChart,
    Settings,
} from "lucide-react";
import { clearAuthSession } from "../../../lib/auth/backend-login";

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

// --- Global Styles (Typography) ---
export function GlobalStyles() {
    return (
        <style jsx global>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');

    :root {
      --bg-color: #ffffff;
      --fg-color: #000000;
      scrollbar-width: thin;
      scrollbar-color: #555555 transparent;
    }

    body {
      background-color: var(--bg-color);
      color: var(--fg-color);
      font-family: 'Space Mono', monospace;
    }
    
    .font-serif { font-family: 'Playfair Display', serif; }
    .font-mono { font-family: 'Space Mono', monospace; }

    .paper-texture {
      position: fixed; inset: 0; z-index: 50; opacity: 0.04; pointer-events: none;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    }

    ::selection { background: #000; color: #fff; }
    /* Neutral scrollbar — avoid white track on dark panels (WhatsApp, emoji picker) */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; border: none; }
    ::-webkit-scrollbar-thumb { background: #555555; border-radius: 8px; }
    ::-webkit-scrollbar-thumb:hover { background: #777777; }

    input[type='checkbox'] {
      appearance: none;
      width: 40px;
      height: 20px;
      border: 1px solid #000;
      border-radius: 99px;
      position: relative;
      cursor: pointer;
      outline: none;
    }
    input[type='checkbox']:checked {
      background: #000;
    }
    input[type='checkbox']::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 14px;
      height: 14px;
      background: #000;
      border-radius: 99px;
      transition: all 0.2s ease;
    }
    input[type='checkbox']:checked::after {
      left: calc(100% - 16px);
      background: #fff;
    }
  `}</style>
    );
}

// --- Massive Mock Data ---

export const uiloraData = {
    daily: [
        { time: "Mon", revenue: 4500, users: 120, conversion: 2.4 },
        { time: "Tue", revenue: 5200, users: 140, conversion: 2.8 },
        { time: "Wed", revenue: 4800, users: 135, conversion: 2.1 },
        { time: "Thu", revenue: 6100, users: 180, conversion: 3.2 },
        { time: "Fri", revenue: 7500, users: 210, conversion: 3.5 },
        { time: "Sat", revenue: 8400, users: 250, conversion: 4.1 },
        { time: "Sun", revenue: 9500, users: 290, conversion: 4.8 },
    ],
    monthly: [
        { time: "Jan", revenue: 120000, users: 3100, conversion: 1.8 },
        { time: "Feb", revenue: 145000, users: 3800, conversion: 2.1 },
        { time: "Mar", revenue: 132000, users: 3400, conversion: 2.0 },
        { time: "Apr", revenue: 156000, users: 4200, conversion: 2.3 },
        { time: "May", revenue: 189000, users: 5100, conversion: 2.6 },
        { time: "Jun", revenue: 215000, users: 6000, conversion: 3.1 },
        { time: "Jul", revenue: 254000, users: 7200, conversion: 3.4 },
    ],
    yearly: [
        { time: "2019", revenue: 1200, users: 40, conversion: 0.8 },
        { time: "2020", revenue: 1800, users: 65, conversion: 1.1 },
        { time: "2021", revenue: 2400, users: 90, conversion: 1.4 },
        { time: "2022", revenue: 3600, users: 140, conversion: 1.8 },
        { time: "2023", revenue: 5200, users: 210, conversion: 2.2 },
        { time: "2024", revenue: 8400, users: 350, conversion: 2.9 },
        { time: "2025", revenue: 12500, users: 550, conversion: 3.5 },
    ]
};

export const uiloraAnalyticsData = {
    devices: [
        { name: "Desktop", value: 45 },
        { name: "Mobile", value: 40 },
        { name: "Tablet", value: 15 },
    ],
    regions: [
        { name: "North America", users: 14500, growth: "+12%" },
        { name: "Europe", users: 8200, growth: "+8%" },
        { name: "Asia Pacific", users: 6400, growth: "+21%" },
        { name: "South America", users: 3100, growth: "+4%" },
    ]
};

export const uiloraCustomers = Array.from({ length: 40 }).map((_, i) => ({
    id: `CUST-${2000 + i}`,
    name: [
        "Emily Dickinson", "Walt Whitman", "Virginia Woolf", 
        "Edgar Allan Poe", "Sylvia Plath", "Oscar Wilde", 
        "Maya Angelou", "Ernest Hemingway"
    ][i % 8] + ` (${i})`,
    plan: i % 5 === 0 ? "Enterprise" : i % 2 === 0 ? "Pro" : "Basic",
    ltv: `$${(Math.random() * 5000 + 500).toFixed(2)}`,
    status: Math.random() > 0.1 ? "Active" : "Churned",
    lastLogin: `${Math.floor(Math.random() * 28 + 1)} Oct 2026`,
    score: Math.floor(Math.random() * 40 + 60),
}));

export const uiloraTransactionsMassive = Array.from({ length: 150 }).map((_, i) => ({
    id: `TRX-${10000 + i}`,
    client: ["Acme Corp", "Stark Ind", "Wayne Ent", "Globex", "Soylent", "Initech", "Uilora Networks", "Cyberdyne"][i % 8] + `-${i}`,
    amount: `$${(Math.random() * 50000 + 100).toFixed(2)}`,
    status: ["Settled", "Settled", "Settled", "Processing", "Declined"][Math.floor(Math.random() * 5)],
    date: `${Math.floor(Math.random() * 30 + 1)} Oct 2026`,
    method: ["Credit Card", "Wire Transfer", "Crypto", "ACH"][i % 4],
}));

export const uiloraIntegrations = [
    { name: "Stripe", category: "Payments", status: true },
    { name: "Slack", category: "Communication", status: true },
    { name: "GitHub", category: "Development", status: false },
    { name: "AWS", category: "Infrastructure", status: true },
    { name: "Salesforce", category: "CRM", status: true },
    { name: "Zendesk", category: "Support", status: false },
    { name: "Figma", category: "Design", status: true },
    { name: "Linear", category: "Project Management", status: false },
];

// --- Editorial Components ---

export function EditorialCard({ children, className, title, subtitle, colSpan = "col-span-1" }: { children: React.ReactNode; className?: string; title?: string; subtitle?: string; colSpan?: string }) {
    return (
        <div className={cn(
            "group relative flex flex-col border-b border-black p-8 transition-colors duration-300 ease-in-out hover:bg-black hover:text-white overflow-hidden",
            className,
            colSpan
        )}>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-0 group-hover:opacity-10 mix-blend-overlay pointer-events-none transition-opacity duration-500" />
            
            {(title || subtitle) && (
                <div className="mb-8 flex items-start justify-between relative z-10">
                    <div>
                        {title && <h3 className="font-serif text-3xl font-light italic leading-snug">{title}</h3>}
                        {subtitle && <p className="font-mono text-xs uppercase tracking-widest opacity-60 mt-2">{subtitle}</p>}
                    </div>
                    <ArrowUpRight className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-4 duration-300" />
                </div>
            )}
            <div className="relative z-10 flex-1 flex flex-col">
                {children}
            </div>
        </div>
    );
}

export function NewsTicker() {
    const segment = "63 Agency - Solution — ";
    const loop = segment.repeat(16);

    return (
        <div className="flex w-full shrink-0 items-center overflow-hidden border-b border-black bg-black py-2 font-mono text-xs tracking-widest whitespace-nowrap text-white">
            <motion.div
                animate={{ x: ["0%", "-50%"] }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="inline-block whitespace-nowrap"
            >
                {loop}
                {loop}
            </motion.div>
        </div>
    );
}

export function ChartPatterns() {
    return (
        <svg height="0" width="0" style={{ position: 'absolute' }}>
            <defs>
                <pattern id="stripe" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="4" stroke="currentColor" strokeWidth="1" />
                </pattern>
                <pattern id="crosshatch" patternUnits="userSpaceOnUse" width="8" height="8">
                    <path d="M0 0L8 8ZM8 0L0 8Z" stroke="currentColor" strokeWidth="1" />
                </pattern>
            </defs>
        </svg>
    );
}

export function DashboardSidebarNav({ pathname }: { pathname: string }) {
    const linkBase =
        "flex items-center gap-3 border px-3 py-2 font-mono text-[11px] uppercase tracking-widest transition";
    const linkIdle = linkBase + " border-transparent hover:border-black hover:bg-black hover:text-white";
    const linkActive = linkBase + " border-black bg-black text-white";

    const overviewActive = pathname === "/dashboard";
    const facturesActive = pathname.startsWith("/dashboard/factures");

    return (
        <aside className="flex w-full shrink-0 flex-col border-b border-black bg-white md:h-full md:w-56 md:shrink-0 md:self-stretch md:overflow-y-auto md:border-b-0 md:border-r md:min-h-0">
            <div className="border-b border-black px-4 py-6">
                <p className="font-serif text-xl italic leading-tight">Uilora</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest opacity-60">
                    Admin
                </p>
            </div>
            <nav className="flex flex-1 flex-col gap-1 p-3">
                <Link
                    href="/dashboard"
                    className={overviewActive ? linkActive : linkIdle}
                >
                    <LayoutDashboard className="size-4 shrink-0" aria-hidden />
                    Vue d&apos;ensemble
                </Link>
                <Link
                    href="/dashboard/factures"
                    className={facturesActive ? linkActive : linkIdle}
                >
                    <FileText className="size-4 shrink-0" aria-hidden />
                    Devis &amp; factures
                </Link>
                <span className={linkIdle + " cursor-not-allowed opacity-40"} title="Bientôt">
                    <PieChart className="size-4 shrink-0" aria-hidden />
                    Analytics
                </span>
                <span className={linkIdle + " cursor-not-allowed opacity-40"} title="Bientôt">
                    <Settings className="size-4 shrink-0" aria-hidden />
                    Paramètres
                </span>
            </nav>
            <div className="border-t border-black p-3">
                <button
                    type="button"
                    className="w-full border border-black bg-white px-3 py-2 font-mono text-[11px] uppercase tracking-widest transition hover:bg-black hover:text-white"
                    onClick={() => {
                        clearAuthSession();
                        window.location.href = "/login";
                    }}
                >
                    Déconnexion
                </button>
            </div>
        </aside>
    );
}
