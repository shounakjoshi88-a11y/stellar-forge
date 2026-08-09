import { useState, useEffect } from "react";
import axios from "axios";
import { Calendar, Trophy, Flame, Clock, Star, TrendingUp } from "lucide-react";

import { API_URL } from "../config.js";

export function AttendeeDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API_URL}/dashboard/attendee`)
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 paper-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <header className="mb-12">
        <div className="flex items-center gap-4 mb-5">
          <span className="stamp text-blue">Membership Card</span>
          <span className="label-mono text-ink-soft">MONTHLY STATEMENT</span>
        </div>
        <h1 className="display text-5xl md:text-6xl mb-4">
          Your <span className="bg-orange text-paper px-2 border-2 border-ink inline-block -rotate-1">Dashboard</span>
        </h1>
        <p className="text-ink-soft text-lg">Track your event journey and achievements.</p>
      </header>

      {/* Stat stamps */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <StatCard icon={Calendar} label="Total Registrations" value={data.totalRegistrations} color="bg-orange" delay="delay-100" />
        <StatCard icon={Clock} label="Upcoming Events" value={data.upcomingEvents} color="bg-blue" delay="delay-200" />
        <StatCard icon={Trophy} label="Completed" value={data.completedEvents} color="bg-lime" delay="delay-300" />
        <StatCard icon={Flame} label="Current Streak" value={`${data.participationStreak} mo`} color="bg-green" delay="delay-400" />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Upcoming Reminders */}
        <div className="paper-card p-8 animate-fade-up delay-100">
          <h2 className="display text-2xl mb-6 flex items-center gap-3">
            <span className="w-10 h-10 bg-blue border-2 border-ink flex items-center justify-center shadow-[3px_3px_0_#1c1813]">
              <Clock className="w-5 h-5 text-paper" />
            </span>
            Upcoming Reminders
          </h2>
          {data.upcomingReminders.length === 0 ? (
            <p className="text-ink-soft">No upcoming events on your radar</p>
          ) : (
            <div className="space-y-4">
              {data.upcomingReminders.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between border-2 border-ink bg-paper-2 p-4">
                  <div>
                    <p className="font-bold text-ink">{r.title}</p>
                    <p className="font-mono text-xs text-ink-soft mt-1 uppercase tracking-wide">
                      {new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {r.location}
                    </p>
                  </div>
                  <CountdownTimer date={r.date} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="paper-card p-8 animate-fade-up delay-200">
          <div className="display text-2xl mb-6 flex items-center gap-3">
            <span className="w-10 h-10 bg-orange border-2 border-ink flex items-center justify-center shadow-[3px_3px_0_#1c1813]">
              <Star className="w-5 h-5 text-paper" />
            </span>
            Recent Activity
          </div>
          {data.recentActivity.length === 0 ? (
            <p className="text-ink-soft">Start registering to see your activity</p>
          ) : (
            <div className="space-y-4">
              {data.recentActivity.map((a: any, i: number) => (
                <div key={i} className="flex items-center justify-between border-2 border-ink bg-paper-2 p-4 hover:bg-lime transition-colors">
                  <div>
                    <p className="font-bold text-ink">{a.eventName}</p>
                    <p className="font-mono text-xs text-ink-soft mt-1">{a.ticketId}</p>
                  </div>
                  <span className="font-mono text-xs text-ink-soft uppercase">
                    {new Date(a.registeredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Favorite Category */}
      <div className="mt-8 bg-ink text-paper border-2 border-ink p-8 shadow-[8px_8px_0_#ff4d00] animate-fade-up delay-300">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-orange border-2 border-ink flex items-center justify-center shadow-[4px_4px_0_#1c1813] shrink-0">
            <TrendingUp className="w-8 h-8 text-ink" />
          </div>
          <div>
            <p className="label-mono text-orange mb-1">Favorite Category</p>
            <p className="display text-4xl">{data.favoriteCategory}</p>
          </div>
          <span className="hidden md:block ml-auto rotate-[-6deg]">
            <span className="stamp text-lime">TOP PICK</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  delay,
}: {
  icon: any;
  label: string;
  value: string | number;
  color: string;
  delay: string;
}) {
  return (
    <div className={`paper-card paper-card-press p-6 animate-fade-up ${delay}`}>
      <div className={`w-12 h-12 ${color} border-2 border-ink flex items-center justify-center mb-4 shadow-[3px_3px_0_#1c1813]`}>
        <Icon className="w-6 h-6 text-ink" />
      </div>
      <p className="display text-4xl mb-1">{value}</p>
      <p className="label-mono text-ink-soft">{label}</p>
    </div>
  );
}

function CountdownTimer({ date }: { date: string | null }) {
  if (!date)
    return (
      <span className="inline-block border-2 border-ink bg-blue text-paper font-mono text-xs px-2 py-1">DATE TBD</span>
    );

  const now = new Date().getTime();
  const target = new Date(date).getTime();
  const diff = target - now;

  if (diff <= 0)
    return (
      <span className="inline-block border-2 border-ink bg-orange text-paper font-mono text-xs px-2 py-1 animate-blink">LIVE!</span>
    );

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return (
    <div className="text-right shrink-0">
      <p className="font-mono text-lg font-bold text-orange">{days}d {hours}h</p>
      <p className="font-mono text-[10px] text-ink-soft uppercase tracking-widest">remaining</p>
    </div>
  );
}