"use client";

import React, { useRef } from "react";
import {
    motion,
    useMotionTemplate,
    useMotionValue,
    AnimatePresence,
} from "framer-motion";
import { 
    LucideIcon, 
    ArrowUpRight, 
    ArrowDownRight, 
    MoreHorizontal, 
    Zap, 
    Users, 
    Activity, 
    Server, 
    ShieldAlert,
    PieChart,
    CreditCard,
    TrendingUp,
    Package,
    FileText,
    Receipt,
} from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell,
    LineChart,
    Line
} from "recharts";
import { cn } from "@/src/lib/utils";

// --- Mock Data ---
export const timeRanges = ["Daily", "Monthly", "Yearly"];

export const dashboardData = {
    Daily: [
        { name: "Mon", revenue: 240, usage: 400, active: 100 },
        { name: "Tue", revenue: 139, usage: 300, active: 150 },
        { name: "Wed", revenue: 980, usage: 500, active: 300 },
        { name: "Thu", revenue: 390, usage: 280, active: 200 },
        { name: "Fri", revenue: 480, usage: 590, active: 350 },
        { name: "Sat", revenue: 380, usage: 320, active: 250 },
        { name: "Sun", revenue: 430, usage: 410, active: 200 },
    ],
    Monthly: [
        { name: "Jan", revenue: 2400, usage: 4000, active: 1200 },
        { name: "Feb", revenue: 1398, usage: 3000, active: 1000 },
        { name: "Mar", revenue: 9800, usage: 5000, active: 2300 },
        { name: "Apr", revenue: 3908, usage: 2800, active: 1800 },
        { name: "May", revenue: 4800, usage: 5900, active: 2500 },
        { name: "Jun", revenue: 3800, usage: 3200, active: 1600 },
        { name: "Jul", revenue: 4300, usage: 4100, active: 1800 },
        { name: "Aug", revenue: 7300, usage: 5300, active: 2800 },
        { name: "Sep", revenue: 8400, usage: 6100, active: 3100 },
        { name: "Oct", revenue: 5600, usage: 4200, active: 2100 },
        { name: "Nov", revenue: 6700, usage: 4900, active: 2400 },
        { name: "Dec", revenue: 9100, usage: 7200, active: 3500 },
    ],
    Yearly: [
        { name: "2019", revenue: 24000, usage: 40000, active: 12000 },
        { name: "2020", revenue: 43980, usage: 60000, active: 15000 },
        { name: "2021", revenue: 69800, usage: 85000, active: 23000 },
        { name: "2022", revenue: 83908, usage: 92800, active: 28000 },
        { name: "2023", revenue: 104800, usage: 155900, active: 35000 },
        { name: "2024", revenue: 143800, usage: 213200, active: 46000 },
    ]
};

export const transactions = [
    { id: 1, user: "Uilora Inc", plan: "Enterprise", amount: "$2,400", date: "Just now", img: "https://api.dicebear.com/7.x/initials/svg?seed=UI" },
    { id: 2, user: "Global Tech", plan: "Pro", amount: "$199", date: "2m ago", img: "https://api.dicebear.com/7.x/initials/svg?seed=GT" },
    { id: 3, user: "Stark Ind", plan: "Enterprise", amount: "$5,000", date: "15m ago", img: "https://api.dicebear.com/7.x/initials/svg?seed=SI" },
    { id: 4, user: "Wayne Ent", plan: "Starter", amount: "$49", date: "1h ago", img: "https://api.dicebear.com/7.x/initials/svg?seed=WE" },
    { id: 5, user: "Umbrella Corp", plan: "Pro", amount: "$199", date: "2h ago", img: "https://api.dicebear.com/7.x/initials/svg?seed=UC" },
    { id: 6, user: "InGen", plan: "Enterprise", amount: "$6,200", date: "5h ago", img: "https://api.dicebear.com/7.x/initials/svg?seed=IG" },
];

export const serverHealth = [
    { region: "US-East (N. Virginia)", status: "Operational", lat: "12ms", load: "42%" },
    { region: "US-West (Oregon)", status: "Operational", lat: "34ms", load: "55%" },
    { region: "EU-Central (Frankfurt)", status: "Degraded", lat: "142ms", load: "98%" },
    { region: "AP-South (Mumbai)", status: "Operational", lat: "45ms", load: "30%" },
    { region: "SA-East (São Paulo)", status: "Operational", lat: "88ms", load: "62%" },
];

// --- Components ---

/**
 * Spotlight Card
 * Tracks mouse position to create a glowing gradient effect on the border and background.
 */
export function SpotlightCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    const divRef = useRef<HTMLDivElement>(null);
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const handleMouseMove = ({ currentTarget, clientX, clientY }: React.MouseEvent) => {
        const { left, top } = currentTarget.getBoundingClientRect();
        mouseX.set(clientX - left);
        mouseY.set(clientY - top);
    };

    return (
        <div
            ref={divRef}
            onMouseMove={handleMouseMove}
            className={cn(
                "group relative border border-zinc-800 bg-zinc-900/50 overflow-hidden rounded-xl",
                className
            )}
        >
            <motion.div
                className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition duration-300 group-hover:opacity-100"
                style={{
                    background: useMotionTemplate`
            radial-gradient(
              650px circle at ${mouseX}px ${mouseY}px,
              rgba(255,255,255,0.1),
              transparent 80%
            )
          `,
                }}
            />
            <div className="relative h-full">{children}</div>
        </div>
    );
}

export function SidebarItem({ icon: Icon, label, active, onClick, collapsed }: { icon: LucideIcon; label: string; active: boolean; onClick: () => void; collapsed: boolean }) {
    return (
    <button
        onClick={onClick}
        className={cn(
            "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            active
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
        )}
    >
        <Icon className="h-4 w-4" />
        {!collapsed && <span>{label}</span>}
        {active && !collapsed && (
            <motion.div
                layoutId="active-pill"
                className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-500"
            />
        )}
    </button>
    );
}

export function TimeToggle({ active, onChange }: { active: string; onChange: (val: string) => void }) {
    return (
        <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-lg">
            {timeRanges.map((range) => (
                <button
                    key={range}
                    onClick={() => onChange(range)}
                    className={cn(
                        "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
                        active === range ? "bg-indigo-600 text-white shadow-md" : "text-zinc-400 hover:text-zinc-200"
                    )}
                >
                    {range}
                </button>
            ))}
        </div>
    );
}

export type DashboardBusinessKpis = {
    pendingDevisMad: number;
    validatedFacturesMad: number;
    clientCount: number;
    clientsSource: "api" | "derived";
    loading: boolean;
    error: string | null;
};

function formatMadDashboard(value: number) {
    return `${new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value)} MAD`;
}

/** Blocs graphiques / tableaux de démo (Uilora) — uniquement si aucun `businessKpis`. */
function LegacyDashboardCharts({ timeRange }: { timeRange: string }) {
    const activeData = dashboardData[timeRange as keyof typeof dashboardData];

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <SpotlightCard className="col-span-1 lg:col-span-2 p-6">
                    <div className="mb-6 flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-medium text-white">Uilora Global Usage Matrix</h3>
                            <p className="text-sm text-zinc-500">API throughput and platform load</p>
                        </div>
                    </div>
                    <div className="h-[350px] min-h-[280px] w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={activeData}>
                                <defs>
                                    <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                                <YAxis yAxisId="left" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px" }}
                                    itemStyle={{ color: "#e4e4e7" }}
                                />
                                <Area yAxisId="left" type="monotone" dataKey="usage" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorUsage)" animationDuration={1000} />
                                <Area yAxisId="right" type="monotone" dataKey="active" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorActive)" animationDuration={1000} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </SpotlightCard>

                <SpotlightCard className="col-span-1 p-6">
                    <div className="mb-6 flex items-center justify-between">
                        <h3 className="text-lg font-medium text-white">Uilora Server Health</h3>
                        <Activity className="h-5 w-5 text-indigo-500" />
                    </div>
                    <div className="space-y-6">
                        {serverHealth.map((server, i) => (
                            <div key={i} className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={cn("h-2 w-2 rounded-full", server.status === "Operational" ? "bg-emerald-500" : "animate-pulse bg-red-500")} />
                                        <span className="text-sm font-medium text-zinc-200">{server.region}</span>
                                    </div>
                                    <span className="font-mono text-xs text-zinc-500">{server.lat}</span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all duration-1000",
                                            parseInt(server.load, 10) > 80 ? "bg-red-500" : "bg-indigo-500",
                                        )}
                                        style={{ width: server.load }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </SpotlightCard>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <SpotlightCard className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-lg font-medium text-white">Recent Enterprise Upgrades</h3>
                        <MoreHorizontal className="h-5 w-5 cursor-pointer text-zinc-500 hover:text-white" />
                    </div>
                    <div className="space-y-4">
                        {transactions.map((t) => (
                            <div
                                key={t.id}
                                className="group flex cursor-pointer items-center justify-between rounded-lg p-2 transition-colors hover:bg-zinc-800/50"
                            >
                                <div className="flex items-center gap-3">
                                    <img
                                        src={t.img}
                                        alt=""
                                        className="h-10 w-10 rounded-full border-2 border-zinc-700 bg-zinc-800"
                                    />
                                    <div>
                                        <p className="text-sm font-medium text-zinc-100 transition-colors group-hover:text-indigo-400">
                                            {t.user}
                                        </p>
                                        <p className="text-xs text-zinc-500">{t.plan}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-medium text-zinc-100">{t.amount}</p>
                                    <p className="text-xs text-zinc-500">{t.date}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </SpotlightCard>

                <SpotlightCard className="group relative overflow-hidden p-6">
                    <div className="absolute right-0 top-0 p-8 opacity-5 transition-opacity group-hover:opacity-10">
                        <Zap className="h-32 w-32 text-indigo-500" />
                    </div>
                    <h3 className="relative z-10 mb-2 text-xl font-medium text-white">Uilora Power System</h3>
                    <p className="relative z-10 mb-8 max-w-sm text-sm text-zinc-400">
                        The infrastructure is running at{" "}
                        <span className="font-medium text-white">92%</span> optimization limit. Allocate more nodes to
                        maintain sub-20ms latency.
                    </p>

                    <div className="relative z-10 space-y-4">
                        <div>
                            <div className="mb-1 flex justify-between text-xs">
                                <span className="text-zinc-400">Compute Threads</span>
                                <span className="text-white">12,400 / 15,000</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-zinc-800">
                                <div className="h-2 w-[82%] rounded-full bg-indigo-500" />
                            </div>
                        </div>
                        <div>
                            <div className="mb-1 flex justify-between text-xs">
                                <span className="text-zinc-400">Storage IOPS</span>
                                <span className="text-white">1.2M / 1.5M</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-zinc-800">
                                <div className="h-2 w-[78%] rounded-full bg-purple-500" />
                            </div>
                        </div>
                        <div>
                            <div className="mb-1 flex justify-between text-xs">
                                <span className="text-zinc-400">Memory Heap</span>
                                <span className="text-white">512 GB / 640 GB</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-zinc-800">
                                <div className="h-2 w-[80%] rounded-full bg-emerald-500" />
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="relative z-10 mt-8 w-full rounded-lg bg-indigo-600 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
                    >
                        Allocate Resource Nodes
                    </button>
                </SpotlightCard>
            </div>
        </>
    );
}

export function DashboardView({
    timeRange,
    businessKpis,
}: {
    timeRange: string;
    businessKpis?: DashboardBusinessKpis | null;
}) {
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-24">
            <div
                className={cn(
                    "grid grid-cols-1 gap-3",
                    businessKpis ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-4",
                )}
            >
                {businessKpis ? (
                    businessKpis.loading ? (
                        <>
                            {[0, 1, 2].map((i) => (
                                <SpotlightCard key={i} className="p-4">
                                    <div className="h-3 w-28 animate-pulse rounded bg-zinc-800" />
                                    <div className="mt-3 h-7 w-36 animate-pulse rounded bg-zinc-800" />
                                </SpotlightCard>
                            ))}
                        </>
                    ) : businessKpis.error ? (
                        <SpotlightCard className="p-4 md:col-span-3">
                            <p className="text-sm text-red-400">{businessKpis.error}</p>
                        </SpotlightCard>
                    ) : (
                        <>
                            <SpotlightCard className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                                        Montant devis (non validé)
                                    </p>
                                    <FileText className="h-4 w-4 shrink-0 text-amber-500/70" aria-hidden />
                                </div>
                                <p className="mt-2 font-mono text-lg font-semibold tabular-nums leading-tight text-white md:text-xl">
                                    {formatMadDashboard(businessKpis.pendingDevisMad)}
                                </p>
                            </SpotlightCard>
                            <SpotlightCard className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                                        Montant validé (factures)
                                    </p>
                                    <Receipt className="h-4 w-4 shrink-0 text-emerald-500/70" aria-hidden />
                                </div>
                                <p className="mt-2 font-mono text-lg font-semibold tabular-nums leading-tight text-white md:text-xl">
                                    {formatMadDashboard(businessKpis.validatedFacturesMad)}
                                </p>
                            </SpotlightCard>
                            <SpotlightCard className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                                        Clients
                                    </p>
                                    <Users className="h-4 w-4 shrink-0 text-indigo-400/70" aria-hidden />
                                </div>
                                <p className="mt-2 font-mono text-lg font-semibold tabular-nums leading-tight text-white md:text-xl">
                                    {businessKpis.clientCount}
                                </p>
                            </SpotlightCard>
                        </>
                    )
                ) : (
                    <>
                        {[
                            {
                                label: "Uilora Revenue",
                                val:
                                    timeRange === "Daily"
                                        ? "$4,231"
                                        : timeRange === "Monthly"
                                          ? "$45,231.89"
                                          : "$894,321",
                                trend: "+20.1%",
                                positive: true,
                            },
                            {
                                label: "Active Subs",
                                val:
                                    timeRange === "Daily"
                                        ? "+12"
                                        : timeRange === "Monthly"
                                          ? "+235"
                                          : "+3,450",
                                trend: "+180.1%",
                                positive: true,
                            },
                            {
                                label: "API Requests",
                                val:
                                    timeRange === "Daily"
                                        ? "1.2M"
                                        : timeRange === "Monthly"
                                          ? "45M"
                                          : "450M",
                                trend: "+19.5%",
                                positive: true,
                            },
                            {
                                label: "Uilora Core Churn",
                                val: "1.2%",
                                trend: "-0.5%",
                                positive: true,
                            },
                        ].map((kpi, i) => (
                            <SpotlightCard key={i} className="p-6 lg:col-span-1">
                                <div className="flex items-start justify-between">
                                    <p className="text-sm font-medium text-zinc-400">{kpi.label}</p>
                                    <span
                                        className={cn(
                                            "flex items-center rounded-full px-2 py-0.5 text-xs",
                                            kpi.positive
                                                ? "bg-emerald-500/10 text-emerald-500"
                                                : "bg-red-500/10 text-red-500",
                                        )}
                                    >
                                        {kpi.positive ? (
                                            <ArrowUpRight className="mr-1 h-3 w-3" />
                                        ) : (
                                            <ArrowDownRight className="mr-1 h-3 w-3" />
                                        )}
                                        {kpi.trend}
                                    </span>
                                </div>
                                <div className="mt-4 text-3xl font-bold text-white">{kpi.val}</div>
                            </SpotlightCard>
                        ))}
                    </>
                )}
            </div>

            <LegacyDashboardCharts timeRange={timeRange} />
        </motion.div>
    );
}

export function AnalyticsView({ timeRange }: { timeRange: string }) {
    const activeData = dashboardData[timeRange as keyof typeof dashboardData];
    
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-24">
            <SpotlightCard className="p-6">
                <div className="mb-6">
                    <h3 className="text-lg font-medium text-white">Uilora Revenue Stream</h3>
                    <p className="text-sm text-zinc-500">Gross transaction volume over {timeRange}</p>
                </div>
                <div className="h-[450px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={activeData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                            <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                            <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                            <Tooltip
                                cursor={{ fill: '#27272a', opacity: 0.4 }}
                                contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px" }}
                            />
                            <Bar dataKey="revenue" radius={[6, 6, 0, 0]} animationDuration={1000}>
                                {activeData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === activeData.length - 1 ? "#8b5cf6" : "#4f46e5"} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </SpotlightCard>
        </motion.div>
    );
}

export function CustomersView({ timeRange }: { timeRange: string }) {
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-24">
             <SpotlightCard className="p-6">
                 <div className="mb-6 flex justify-between items-center">
                     <div>
                         <h3 className="text-lg font-medium text-white">Uilora Customer Base</h3>
                         <p className="text-sm text-zinc-500">Manage your enterprise and pro tier clients</p>
                     </div>
                     <button className="bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 transition">Export CSV</button>
                 </div>
                 
                 <div className="overflow-x-auto">
                     <table className="w-full text-left text-sm text-zinc-400">
                         <thead className="text-xs text-zinc-500 uppercase bg-zinc-900/50 border-b border-zinc-800">
                             <tr>
                                 <th className="px-4 py-4 font-medium">Customer</th>
                                 <th className="px-4 py-4 font-medium">Subscription</th>
                                 <th className="px-4 py-4 font-medium">MRR</th>
                                 <th className="px-4 py-4 font-medium">Status</th>
                                 <th className="px-4 py-4 font-medium text-right">Actions</th>
                             </tr>
                         </thead>
                         <tbody>
                             {transactions.map((t, i) => (
                                 <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors group">
                                     <td className="px-4 py-4 flex items-center gap-3">
                                         <img src={t.img} className="w-8 h-8 rounded-md bg-zinc-800" />
                                         <span className="font-medium text-zinc-200 group-hover:text-indigo-400 transition">{t.user}</span>
                                     </td>
                                     <td className="px-4 py-4">
                                         <span className="bg-zinc-800 text-zinc-300 px-2 py-1 rounded text-xs">{t.plan}</span>
                                     </td>
                                     <td className="px-4 py-4 font-mono text-zinc-300">{t.amount}</td>
                                     <td className="px-4 py-4">
                                         <span className="flex items-center gap-2 text-emerald-500"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active</span>
                                     </td>
                                     <td className="px-4 py-4 text-right">
                                         <MoreHorizontal className="w-5 h-5 text-zinc-500 inline cursor-pointer hover:text-white" />
                                     </td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                 </div>
             </SpotlightCard>
        </motion.div>
    );
}

export function FinanceView({ timeRange }: { timeRange: string }) {
     const activeData = dashboardData[timeRange as keyof typeof dashboardData];
     return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-24">
             <SpotlightCard className="p-6">
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-medium text-white">Uilora Cash Flow Analysis</h3>
                        <p className="text-sm text-zinc-500">Net revenue vs projected targets</p>
                    </div>
                </div>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={activeData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                            <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                            <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                            <Tooltip contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px" }} />
                            <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                            <Line type="monotone" dataKey="usage" stroke="#6366f1" strokeDasharray="5 5" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
             </SpotlightCard>
        </motion.div>
     );
}

export function ProductsView() {
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-24">
            {['Uilora API Service', 'Uilora Core Engine', 'Webhooks Pro', 'Analytics Plugin', 'SSO Module', 'Audit Logs'].map((prod, i) => (
                <SpotlightCard key={i} className="p-6 flex flex-col gap-4">
                    <div className="p-3 bg-zinc-800 w-12 h-12 rounded-lg flex items-center justify-center">
                        <Package className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <h4 className="font-medium text-white text-lg">{prod}</h4>
                        <p className="text-sm text-zinc-400 mt-1">Enterprise grade solution configured and deployed in 3 regions globally.</p>
                    </div>
                    <div className="mt-auto pt-4 border-t border-zinc-800 flex justify-between items-center">
                        <span className="text-xs text-zinc-500">{Math.floor(Math.random() * 50)}k active installations</span>
                        <ArrowUpRight className="w-5 h-5 text-zinc-600 hover:text-white cursor-pointer transition" />
                    </div>
                </SpotlightCard>
            ))}
        </motion.div>
    );
}