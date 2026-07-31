"use client";

import { useCallback, useEffect, useMemo, useRef, useState, forwardRef } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Eye,
  ExternalLink,
  Loader2,
  Plus,
  Ban,
} from "lucide-react";
import {
  Calendar,
  dateFnsLocalizer,
  type EventProps,
  type SlotInfo,
  type View,
} from "react-big-calendar";
import { format, getDay, parse, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { isAdminWhatsAppRole, isFullAdminRole } from "@/lib/auth/roles";
import { getStoredUser } from "@/lib/auth/backend-login";
import {
  fetchBlockedDays,
  fetchMeetingStats,
  fetchMeetings,
} from "@/lib/meetings/backend-meetings";
import { blockedDayKeys, blockedDayMap, filterUpcomingBlockedDays, getBlockedDay, isActiveBlockedDay } from "@/lib/meetings/blocked-days";
import { countMeetingsByDate, getMeetingCountForDate } from "@/lib/meetings/calendar-meetings";
import {
  calendarRangeIso,
  casablancaDayKey,
} from "@/lib/meetings/meeting-datetime";
import {
  DEFAULT_MEETING_DURATION_MINUTES,
  MEETING_STATUS_COLORS,
  MEETING_STATUS_LABELS,
  MEETING_STATUSES,
  type Meeting,
  type MeetingStats,
  type MeetingStatus,
  type BlockedDay,
} from "@/lib/meetings/types";
import { cn } from "@/src/lib/utils";
import { BlockedDaysPanel } from "./BlockedDaysPanel";
import { CalendarDayHeader, CalendarShowMore } from "./CalendarDayHeader";
import { MeetingDetailPanel } from "./MeetingDetailPanel";
import { MeetingFormModal } from "./MeetingFormModal";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = { fr };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Meeting;
};

type AppView = "month" | "week" | "list";
type DayFilter = "today" | "tomorrow" | "week" | "date" | "all";

const emptyStats: MeetingStats = {
  today: 0,
  thisWeek: 0,
  upcoming: 0,
  total: 0,
  noShow: 0,
};

/** Week grid: 08:00–20:00 local. */
const WEEK_MIN = new Date(1970, 0, 1, 8, 0, 0);
const WEEK_MAX = new Date(1970, 0, 1, 20, 0, 0);

function EventChip({ event }: EventProps<CalendarEvent>) {
  const status = event.resource.status;
  const colors = MEETING_STATUS_COLORS[status];
  return (
    <span className="block truncate px-0.5 text-[11px] font-medium leading-tight">
      <span
        className="mr-1 inline-block size-1.5 rounded-full"
        style={{ backgroundColor: colors.calendar }}
      />
      {event.title}
    </span>
  );
}

export function CalendrierPage() {
  const [view, setView] = useState<AppView>("month");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [stats, setStats] = useState<MeetingStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<MeetingStatus | "all">("all");
  const [dayFilter, setDayFilter] = useState<DayFilter>("today");
  const [customDate, setCustomDate] = useState(() => casablancaDayKey());
  const [listSortAsc, setListSortAsc] = useState(true);
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [prefillDate, setPrefillDate] = useState<Date | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canSendReminder, setCanSendReminder] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [blockedDays, setBlockedDays] = useState<BlockedDay[]>([]);
  const [blockedDaysOpen, setBlockedDaysOpen] = useState(false);
  const [blockedPanelMode, setBlockedPanelMode] = useState<"block" | "unblock" | "view">("block");
  const [blockedFocusDate, setBlockedFocusDate] = useState<string | null>(null);
  const tableSectionRef = useRef<HTMLElement>(null);

  const todayKey = casablancaDayKey();

  useEffect(() => {
    const user = getStoredUser();
    const role = user?.role ?? "";
    setIsAdmin(isFullAdminRole(role));
    setCanSendReminder(isFullAdminRole(role) || isAdminWhatsAppRole(role));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => {
      setIsMobile(mq.matches);
      if (mq.matches) setView("list");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const effectiveView: AppView = isMobile ? "list" : view;
  /** Calendar only for Mois/Semaine on desktop; table always visible below. */
  const showCalendar = !isMobile && effectiveView !== "list";

  const upcomingBlocked = useMemo(
    () => filterUpcomingBlockedDays(blockedDays, todayKey),
    [blockedDays, todayKey],
  );
  const activeBlockedKeys = useMemo(
    () => blockedDayKeys(upcomingBlocked),
    [upcomingBlocked],
  );
  const activeBlockedByDate = useMemo(
    () => blockedDayMap(upcomingBlocked),
    [upcomingBlocked],
  );
  const meetingsCountByDate = useMemo(
    () => countMeetingsByDate(meetings),
    [meetings],
  );

  const openBlockPanel = useCallback((dateKey?: string | null) => {
    setBlockedPanelMode("block");
    setBlockedFocusDate(dateKey ?? null);
    setBlockedDaysOpen(true);
  }, []);

  const openUnblockPanel = useCallback((dateKey: string) => {
    setBlockedPanelMode("unblock");
    setBlockedFocusDate(dateKey);
    setBlockedDaysOpen(true);
  }, []);

  const openViewBlockedPanel = useCallback((dateKey: string) => {
    setBlockedPanelMode("view");
    setBlockedFocusDate(dateKey);
    setBlockedDaysOpen(true);
  }, []);

  const focusDayInTable = useCallback((date: Date) => {
    const key = casablancaDayKey(date);
    setCustomDate(key);
    setDayFilter("date");
    requestAnimationFrame(() => {
      tableSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const loadBlockedDays = useCallback(async () => {
    try {
      const futureEnd = casablancaDayKey(
        new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      );
      const range =
        effectiveView === "list"
          ? { from: todayKey, to: futureEnd }
          : (() => {
              const { to } = calendarRangeIso(calendarDate);
              return {
                from: todayKey,
                to: casablancaDayKey(to),
              };
            })();
      const days = await fetchBlockedDays(range);
      setBlockedDays(filterUpcomingBlockedDays(days, todayKey));
    } catch {
      setBlockedDays([]);
    }
  }, [calendarDate, effectiveView, todayKey]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const range =
        effectiveView === "list"
          ? {
              from: new Date(
                Date.now() - 30 * 24 * 60 * 60 * 1000,
              ).toISOString(),
              to: new Date(
                Date.now() + 90 * 24 * 60 * 60 * 1000,
              ).toISOString(),
            }
          : calendarRangeIso(calendarDate);
      const [items, nextStats] = await Promise.all([
        fetchMeetings({
          from: range.from,
          to: range.to,
          status: statusFilter === "all" ? undefined : statusFilter,
        }),
        fetchMeetingStats(),
      ]);
      setMeetings(items);
      setStats(nextStats);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Impossible de charger le calendrier.",
      );
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, [calendarDate, statusFilter, effectiveView]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadBlockedDays();
  }, [loadBlockedDays]);

  const events: CalendarEvent[] = useMemo(
    () =>
      meetings.map((m) => {
        const start = new Date(m.meetingDate);
        const mins = m.durationMinutes || DEFAULT_MEETING_DURATION_MINUTES;
        const end = new Date(start.getTime() + mins * 60 * 1000);
        return {
          id: m.id,
          title: m.title,
          start,
          end,
          resource: m,
        };
      }),
    [meetings],
  );

  const tableMeetings = useMemo(() => {
    const today = casablancaDayKey();
    const tomorrowDate = new Date(`${today}T12:00:00`);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = casablancaDayKey(tomorrowDate);

    const weekEnd = new Date(`${today}T12:00:00`);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndKey = casablancaDayKey(weekEnd);

    const filtered = meetings.filter((m) => {
      const key = casablancaDayKey(m.meetingDate);
      if (dayFilter === "today") return key === today;
      if (dayFilter === "tomorrow") return key === tomorrow;
      if (dayFilter === "date") return key === customDate;
      if (dayFilter === "week") return key >= today && key < weekEndKey;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const diff =
        new Date(a.meetingDate).getTime() - new Date(b.meetingDate).getTime();
      return listSortAsc ? diff : -diff;
    });
  }, [meetings, dayFilter, customDate, listSortAsc]);

  const rbcView: View = effectiveView === "week" ? "week" : "month";

  const openCreate = (date?: Date) => {
    if (date && isActiveBlockedDay(date, activeBlockedKeys, todayKey)) {
      if (isAdmin) {
        openUnblockPanel(casablancaDayKey(date));
      } else {
        openViewBlockedPanel(casablancaDayKey(date));
      }
      return;
    }
    setEditing(null);
    setPrefillDate(date ?? new Date());
    setFormOpen(true);
  };

  const openEdit = (meeting: Meeting) => {
    setSelected(null);
    setEditing(meeting);
    setPrefillDate(null);
    setFormOpen(true);
  };

  const handleSelectSlot = (slot: SlotInfo) => {
    const dayKey = casablancaDayKey(slot.start);

    if (isActiveBlockedDay(slot.start, activeBlockedKeys, todayKey)) {
      if (isAdmin) {
        openUnblockPanel(dayKey);
      } else {
        openViewBlockedPanel(dayKey);
      }
      return;
    }

    openCreate(slot.start);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelected(event.resource);
  };

  const handleSaved = (meeting: Meeting) => {
    setMeetings((prev) => {
      const idx = prev.findIndex((m) => m.id === meeting.id);
      if (idx === -1) return [...prev, meeting];
      const next = [...prev];
      next[idx] = meeting;
      return next;
    });
    setSelected((prev) => (prev?.id === meeting.id ? meeting : prev));
    void fetchMeetingStats().then(setStats).catch(() => undefined);
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    const color = MEETING_STATUS_COLORS[event.resource.status].calendar;
    return {
      style: {
        backgroundColor: `${color}33`,
        color: "#e4e4e7",
        borderRadius: "6px",
        border: "none",
        borderLeftWidth: 3,
        borderLeftStyle: "solid" as const,
        borderLeftColor: color,
      },
    };
  };

  const dayPropGetter = (date: Date) => {
    if (!isActiveBlockedDay(date, activeBlockedKeys, todayKey)) return {};
    const blocked = getBlockedDay(date, activeBlockedByDate);
    return {
      className: "rbc-blocked-day",
      title: blocked?.reason
        ? `Indisponible — ${blocked.reason}`
        : "Jour indisponible",
    };
  };

  const calendarComponents = useMemo(
    () => ({
      event: EventChip,
      showMore: CalendarShowMore,
      month: {
        dateHeader: ({ label, date }: { label: string; date: Date }) => (
          <CalendarDayHeader
            label={label}
            meetingCount={getMeetingCountForDate(date, meetingsCountByDate)}
            blocked={
              isActiveBlockedDay(date, activeBlockedKeys, todayKey)
                ? getBlockedDay(date, activeBlockedByDate)
                : undefined
            }
            onMeetingCountClick={() => focusDayInTable(date)}
          />
        ),
      },
    }),
    [
      activeBlockedByDate,
      activeBlockedKeys,
      focusDayInTable,
      meetingsCountByDate,
      todayKey,
    ],
  );

  const messages = {
    today: "Aujourd'hui",
    previous: "Précédent",
    next: "Suivant",
    month: "Mois",
    week: "Semaine",
    day: "Jour",
    agenda: "Agenda",
    date: "Date",
    time: "Heure",
    event: "Événement",
    noEventsInRange: "Aucun rendez-vous sur cette période.",
    showMore: (total: number) => `+${total} RDV`,
  };

  return (
    <div className="app-scroll min-h-0 flex-1 overflow-y-auto bg-zinc-950">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="size-5 text-emerald-400" />
              <h1 className="text-xl font-semibold text-white sm:text-2xl">
                Calendrier
              </h1>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Rendez-vous · fuseau Africa/Casablanca
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {isAdmin ? (
              <button
                type="button"
                onClick={() => openBlockPanel()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
              >
                <Ban className="size-4 text-red-400" />
                Indisponibilités
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => openCreate()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              <Plus className="size-4" />
              Nouveau rendez-vous
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Aujourd'hui", value: stats.today, color: "text-white" },
            {
              label: "Cette semaine",
              value: stats.thisWeek,
              color: "text-emerald-400",
            },
            {
              label: "À venir",
              value: stats.upcoming,
              color: "text-sky-400",
            },
            { label: "Total", value: stats.total, color: "text-zinc-200" },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4"
            >
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                {card.label}
              </p>
              <p
                className={cn(
                  "mt-1 text-2xl font-bold tabular-nums",
                  card.color,
                )}
              >
                {card.value}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex rounded-xl bg-zinc-900 p-1 ring-1 ring-zinc-800">
            {(
              [
                { id: "month" as const, label: "Mois", hideMobile: true },
                { id: "week" as const, label: "Semaine", hideMobile: true },
                { id: "list" as const, label: "Liste", hideMobile: false },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium transition",
                  tab.hideMobile && "hidden sm:inline-flex",
                  effectiveView === tab.id
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value === "all"
                  ? "all"
                  : (e.target.value as MeetingStatus),
              )
            }
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500"
          >
            <option value="all">Tous les statuts</option>
            {MEETING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {MEETING_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-24 text-zinc-500">
            <Loader2 className="size-6 animate-spin text-emerald-500" />
            Chargement…
          </div>
        ) : null}

        {!loading && showCalendar ? (
          <div className="meetings-calendar">
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  setCalendarDate((d) => {
                    const n = new Date(d);
                    if (effectiveView === "week") n.setDate(n.getDate() - 7);
                    else n.setMonth(n.getMonth() - 1);
                    return n;
                  })
                }
                className="flex size-9 items-center justify-center rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                aria-label="Période précédente"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setCalendarDate(new Date())}
                className="rounded-xl border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
              >
                Aujourd&apos;hui
              </button>
              <button
                type="button"
                onClick={() =>
                  setCalendarDate((d) => {
                    const n = new Date(d);
                    if (effectiveView === "week") n.setDate(n.getDate() + 7);
                    else n.setMonth(n.getMonth() + 1);
                    return n;
                  })
                }
                className="flex size-9 items-center justify-center rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                aria-label="Période suivante"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="h-[min(680px,70vh)] min-h-[420px]">
              <Calendar
                localizer={localizer}
                culture="fr"
                events={events}
                view={rbcView}
                onView={() => undefined}
                date={calendarDate}
                onNavigate={setCalendarDate}
                toolbar={false}
                selectable
                popup
                messages={messages}
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
                eventPropGetter={eventStyleGetter}
                dayPropGetter={dayPropGetter}
                components={calendarComponents}
                min={effectiveView === "week" ? WEEK_MIN : undefined}
                max={effectiveView === "week" ? WEEK_MAX : undefined}
                step={30}
                timeslots={2}
                style={{ height: "100%" }}
              />
            </div>
          </div>
        ) : null}

        {!loading ? (
          <MeetingsFilteredTable
            ref={tableSectionRef}
            meetings={tableMeetings}
            totalMeetingsOnDay={
              dayFilter === "date" && customDate
                ? getMeetingCountForDate(customDate, meetingsCountByDate)
                : undefined
            }
            dayFilter={dayFilter}
            customDate={customDate}
            sortAsc={listSortAsc}
            onDayFilterChange={setDayFilter}
            onCustomDateChange={(value) => {
              setCustomDate(value);
              setDayFilter("date");
            }}
            onToggleSort={() => setListSortAsc((v) => !v)}
            onSelect={setSelected}
          />
        ) : null}
      </div>

      <MeetingDetailPanel
        meeting={selected}
        isAdmin={isAdmin}
        canSendReminder={canSendReminder}
        onClose={() => setSelected(null)}
        onEdit={openEdit}
        onChanged={(m) => {
          if (!m) {
            setMeetings((prev) => prev.filter((x) => x.id !== selected?.id));
            setSelected(null);
          } else {
            handleSaved(m);
          }
          void fetchMeetingStats().then(setStats).catch(() => undefined);
        }}
      />

      <MeetingFormModal
        open={formOpen}
        meeting={editing}
        prefillDate={prefillDate}
        blockedDayKeys={activeBlockedKeys}
        blockedDays={upcomingBlocked}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setPrefillDate(null);
        }}
        onSaved={handleSaved}
      />

      <BlockedDaysPanel
        open={blockedDaysOpen}
        mode={blockedPanelMode}
        blockedDay={
          blockedFocusDate
            ? getBlockedDay(blockedFocusDate, activeBlockedByDate) ?? null
            : null
        }
        prefillDate={blockedFocusDate}
        blockedDays={upcomingBlocked}
        onClose={() => {
          setBlockedDaysOpen(false);
          setBlockedFocusDate(null);
        }}
        onChanged={() => void loadBlockedDays()}
      />
    </div>
  );
}

const MeetingsFilteredTable = forwardRef<
  HTMLElement,
  {
    meetings: Meeting[];
    totalMeetingsOnDay?: number;
    dayFilter: DayFilter;
    customDate: string;
    sortAsc: boolean;
    onDayFilterChange: (filter: DayFilter) => void;
    onCustomDateChange: (value: string) => void;
    onToggleSort: () => void;
    onSelect: (m: Meeting) => void;
  }
>(function MeetingsFilteredTable(
  {
    meetings,
    totalMeetingsOnDay,
    dayFilter,
    customDate,
    sortAsc,
    onDayFilterChange,
    onCustomDateChange,
    onToggleSort,
    onSelect,
  },
  ref,
) {
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 10;

  const filterLabel =
    dayFilter === "today"
      ? "Aujourd'hui"
      : dayFilter === "tomorrow"
        ? "Demain"
        : dayFilter === "week"
          ? "7 prochains jours"
          : dayFilter === "date"
            ? customDate
              ? new Date(`${customDate}T12:00:00`).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })
              : "Date"
            : "Tous";

  const filters: { id: DayFilter; label: string }[] = [
    { id: "today", label: "Aujourd'hui" },
    { id: "tomorrow", label: "Demain" },
    { id: "week", label: "Cette semaine" },
    { id: "date", label: "Une date" },
    { id: "all", label: "Tous" },
  ];

  const totalPages = Math.max(1, Math.ceil(meetings.length / PER_PAGE));
  const paginated = meetings.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [dayFilter, customDate, meetings.length]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pageItems = useMemo<(number | "...")[]>(() => {
    if (totalPages <= 3) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const items: (number | "...")[] = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    if (start > 2) items.push("...");
    for (let page = start; page <= end; page += 1) items.push(page);
    if (end < totalPages - 1) items.push("...");
    items.push(totalPages);
    return items;
  }, [currentPage, totalPages]);

  return (
    <section ref={ref} className="min-h-[200px]">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-medium text-white">Rendez-vous</h3>
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            {meetings.length} rendez-vous — {filterLabel}
            {totalMeetingsOnDay != null && totalMeetingsOnDay > 0 ? (
              <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-emerald-300">
                {totalMeetingsOnDay} ce jour
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2 font-mono text-[11px] uppercase tracking-widest">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onDayFilterChange(f.id)}
                className={cn(
                  "border px-3 py-2 transition",
                  dayFilter === f.id
                    ? "border-zinc-700 bg-zinc-800 text-white"
                    : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          {dayFilter === "date" ? (
            <input
              type="date"
              value={customDate}
              onChange={(e) => onCustomDateChange(e.target.value)}
              className="border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200 outline-none focus:border-zinc-500"
            />
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse font-mono text-sm text-zinc-300">
          <thead>
            <tr className="border-b border-zinc-700 text-left text-[10px] uppercase tracking-widest text-zinc-500">
              <th className="pb-2 pr-4 font-normal">
                <button
                  type="button"
                  onClick={onToggleSort}
                  className="hover:text-zinc-300"
                >
                  Date {sortAsc ? "↑" : "↓"}
                </button>
              </th>
              <th className="pb-2 pr-4 font-normal">Heure</th>
              <th className="pb-2 pr-4 font-normal">Contact</th>
              <th className="pb-2 pr-4 font-normal">Titre</th>
              <th className="pb-2 pr-4 font-normal">Statut</th>
              <th className="pb-2 pl-4 text-right font-normal">Action</th>
            </tr>
          </thead>
          <tbody>
            {meetings.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-zinc-500">
                  Aucun rendez-vous pour ce filtre.
                </td>
              </tr>
            ) : (
              paginated.map((m) => {
                const d = new Date(m.meetingDate);
                return (
                  <tr
                    key={m.id}
                    className="border-b border-zinc-800 transition hover:bg-zinc-800/50"
                  >
                    <td className="py-3 pr-4">
                      {d.toLocaleDateString("fr-FR", {
                        timeZone: "Africa/Casablanca",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 pr-4">
                      {d.toLocaleTimeString("fr-FR", {
                        timeZone: "Africa/Casablanca",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 pr-4">{m.contactName}</td>
                    <td className="py-3 pr-4">{m.title}</td>
                    <td className="py-3 pr-4">
                      {MEETING_STATUS_LABELS[m.status]}
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSelect(m)}
                          className="inline-flex items-center justify-center rounded border border-zinc-700 p-1.5 text-zinc-300 hover:bg-zinc-800"
                          title="Voir le rendez-vous"
                          aria-label="Voir le rendez-vous"
                        >
                          <Eye className="size-3.5" aria-hidden />
                        </button>
                        {m.meetLink ? (
                          <a
                            href={m.meetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded border border-emerald-700/60 p-1.5 text-emerald-300 hover:bg-emerald-900/30"
                            title="Rejoindre Meet"
                            aria-label="Rejoindre Meet"
                          >
                            <ExternalLink className="size-3.5" aria-hidden />
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {meetings.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-3 font-mono text-[11px] uppercase tracking-widest text-zinc-400">
          <p>
            Page {currentPage} / {totalPages} - {meetings.length} rendez-vous
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded border border-zinc-700 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Precedent
            </button>
            {pageItems.map((item, idx) =>
              item === "..." ? (
                <span key={`dots-${idx}`} className="px-1 text-zinc-500">
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCurrentPage(item)}
                  className={`rounded border px-2.5 py-1.5 ${
                    item === currentPage
                      ? "border-zinc-500 bg-zinc-800 text-white"
                      : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  {item}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={currentPage === totalPages}
              className="rounded border border-zinc-700 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
});