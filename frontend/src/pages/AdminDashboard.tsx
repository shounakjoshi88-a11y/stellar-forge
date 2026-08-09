import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Calendar, Users, TrendingUp, BarChart3, Radio, ScanLine, Shield, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useAdminRegistrationStream, useRealtimeRefresh } from "../hooks/useLive.js";
import { LiveFeedTicker } from "../components/LiveFeedTicker.js";
import { StampIn, CountUp } from "../components/motion.js";

import { API_URL } from "../config.js";
const COLORS = ["#ff4d00", "#2453ff", "#c9e62e", "#e2231a", "#0e8a3e", "#1c1813"];

export function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<{ month: string; registrations: number }[]>([]);

  const load = useCallback(async (silent = false) => {
    try {
      const res = await axios.get(`${API_URL}/dashboard/admin`);
      setData(res.data);
      setChartData(
        Object.entries(res.data.monthlyStats ?? {}).map(([month, count]) => ({
          month,
          registrations: count as number,
        }))
      );
    } finally {
      setLoading(false);
    }
    void silent;
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: refetch the whole ledger the moment any write fires (new
  // registration, cancel, event open/close, scan) — every card stays live.
  useRealtimeRefresh(() => load(true));

  // Live SSE: new registrations append to the current month's bar
  useAdminRegistrationStream((timestamp) => {
    const month = timestamp.slice(0, 7);
    setChartData((prev) => {
      const existing = prev.find((p) => p.month === month);
      if (existing) {
        return prev.map((p) => (p.month === month ? { ...p, registrations: p.registrations + 1 } : p));
      }
      return [...prev, { month, registrations: 1 }].sort((a, b) => a.month.localeCompare(b.month));
    });
  });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 skeleton-stripes" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const monthlyData = chartData;

  const categoryData = Object.entries(data.categoryStats).map(([name, value]) => ({ name, value }));

  const tooltipStyle = {
    background: "#1c1813",
    border: "2px solid #ff4d00",
    borderRadius: 0,
    color: "#f4efe4",
    fontFamily: "IBM Plex Mono, monospace",
    fontSize: 12,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="mb-12">
        <div className="flex items-center gap-4 mb-5">
          <StampIn className="stamp text-red">RESTRICTED</StampIn>
          <span className="label-mono text-ink-soft">MANAGER ISSUE · OVERVIEW</span>
        </div>
        <h1 className="display text-5xl md:text-6xl mb-4">
          Admin <span className="bg-red text-paper px-2 border-2 border-ink inline-block rotate-1">Ledger</span>
        </h1>
        <p className="text-ink-soft text-lg">Every number that matters, in ink — as it happens.</p>
      </header>

      {/* Operating desk — the buttons that run the front desk */}
      <div className="grid sm:grid-cols-3 gap-6 mb-12">
        <Link to="/admin/events" className="paper-card paper-card-press p-6 group">
          <div className="flex items-center justify-between mb-4">
            <span className="label-mono text-ink-soft">EVENTS</span>
            <Calendar className="w-6 h-6 text-orange" />
          </div>
          <p className="display text-2xl mb-1 flex items-center gap-2">
            Manage Events
            <ArrowRight className="w-5 h-5 text-orange group-hover:translate-x-1 transition-transform" />
          </p>
          <p className="text-ink-soft text-sm">Create, edit, open/close registrations, post updates</p>
        </Link>

        <Link to="/admin/scan" className="paper-card paper-card-press p-6 group">
          <div className="flex items-center justify-between mb-4">
            <span className="label-mono text-ink-soft">GATE</span>
            <ScanLine className="w-6 h-6 text-lime" />
          </div>
          <p className="display text-2xl mb-1 flex items-center gap-2">
            Gate Scanner
            <ArrowRight className="w-5 h-5 text-lime group-hover:translate-x-1 transition-transform" />
          </p>
          <p className="text-ink-soft text-sm">Scan tickets at the door or type codes manually</p>
        </Link>

        <Link to="/admin/team" className="paper-card paper-card-press p-6 group">
          <div className="flex items-center justify-between mb-4">
            <span className="label-mono text-ink-soft">ACCESS</span>
            <Shield className="w-6 h-6 text-blue" />
          </div>
          <p className="display text-2xl mb-1 flex items-center gap-2">
            Team & Access
            <ArrowRight className="w-5 h-5 text-blue group-hover:translate-x-1 transition-transform" />
          </p>
          <p className="text-ink-soft text-sm">Grant or revoke admin roles, view the audit log</p>
        </Link>
      </div>

      {/* Stats — clickable, tick when the server pushes a refresh */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
        <AdminStatCard icon={Calendar} to="/admin/events" label="Total Events" value={data.totalEvents} color="bg-orange" />
        <AdminStatCard icon={Calendar} to="/admin/events?status=upcoming" label="Upcoming" value={data.upcomingEvents} color="bg-blue" />
        <AdminStatCard icon={Calendar} to="/admin/events?status=completed" label="Completed" value={data.completedEvents} color="bg-lime" />
        <AdminStatCard icon={Users} to="/admin/attendees" label="Attendees" value={data.totalAttendees} color="bg-paper-2" />
        <AdminStatCard icon={TrendingUp} to="/admin/registrations" label="Registrations" value={data.totalRegistrations} color="bg-orange" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        <div className="paper-card p-8 animate-fade-up delay-100">
          <h2 className="display text-2xl mb-6 flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-orange" />
            Registration Trends
            <span className="ml-auto inline-block bg-green text-paper border-2 border-ink label-mono text-[9px] px-2 py-1 animate-blink">
              LIVE
            </span>
          </h2>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData} barCategoryGap="25%">
                <XAxis dataKey="month" stroke="#6f6757" fontSize={12} tickLine={false} axisLine={{ stroke: "#1c1813" }} />
                <YAxis stroke="#6f6757" fontSize={12} tickLine={false} axisLine={{ stroke: "#1c1813" }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(28,24,19,0.06)" }} />
                <Bar dataKey="registrations" fill="#ff4d00" stroke="#1c1813" strokeWidth={2} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-ink-soft">No data available yet</p>
          )}
        </div>

        <div className="paper-card p-8 animate-fade-up delay-200">
          <h2 className="display text-2xl mb-6 flex items-center gap-3">
            <Radio className="w-5 h-5 text-orange" />
            Live at the Gate
            <span className="ml-auto inline-block bg-green text-paper border-2 border-ink label-mono text-[9px] px-2 py-1 animate-blink">
              WS
            </span>
          </h2>
          <LiveFeedTicker />
        </div>

        <div className="paper-card p-8 animate-fade-up delay-300">
          <h2 className="display text-2xl mb-6">Events by Category</h2>
          {categoryData.length > 0 ? (
            <div className="flex items-center gap-8">
              <ResponsiveContainer width="50%" height={250}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} stroke="#1c1813" strokeWidth={2}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 flex-1">
                {categoryData.map((c: any, i: number) => (
                  <div key={c.name} className="flex items-center gap-3 border-b-2 border-dashed border-ink pb-2">
                    <div className="w-4 h-4 border-2 border-ink" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="font-mono text-xs uppercase tracking-wide">{c.name}</span>
                    <span className="font-mono text-sm font-bold ml-auto">{c.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-ink-soft">No category data yet</p>
          )}
        </div>
      </div>

      {/* Event Fill Rates */}
      <div className="paper-card p-8 animate-fade-up delay-300">
        <h2 className="display text-2xl mb-6">Event Capacity</h2>
        <div className="space-y-5">
          {data.eventStats.map((e: any) => (
            <div key={e.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <span className="font-mono text-sm w-full sm:w-56 truncate font-semibold">{e.title}</span>
              <div className="flex-1 w-full h-5 border-2 border-ink bg-paper-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-700 ${
                    e.fillRate >= 80 ? "bg-red" : e.fillRate >= 50 ? "bg-orange" : "bg-green"
                  }`}
                  style={{ width: `${Math.min(e.fillRate, 100)}%` }}
                />
              </div>
              <span className="font-mono text-xs text-ink-soft w-full sm:w-24 text-left sm:text-right">
                {e.registered}/{e.capacity} seats
              </span>
              <span className="font-mono text-sm font-bold w-12 text-right">{e.fillRate}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminStatCard({
  icon: Icon,
  label,
  value,
  color,
  to,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
  to: string;
}) {
  return (
    <Link to={to} className="paper-card paper-card-press p-6 group block">
      <div className={`w-12 h-12 ${color} border-2 border-ink flex items-center justify-center mb-4 shadow-[3px_3px_0_#1c1813]`}>
        <Icon className="w-6 h-6 text-ink" />
      </div>
      <p className="display text-4xl mb-1">
        <CountUp value={value} />
      </p>
      <p className="label-mono text-ink-soft flex items-center gap-1.5">
        {label}
        <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
      </p>
    </Link>
  );
}