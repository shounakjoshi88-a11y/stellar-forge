import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { ArrowLeft, Search, Shield, ShieldOff, UserCheck, History, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { useAuth } from "../context/AuthContext.js";
import { useToast } from "../context/ToastContext.js";
import { useShortcut } from "../hooks/useShortcut.js";

import { API_URL } from "../config.js";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

interface AuditEntry {
  id: string;
  actorEmail: string;
  targetEmail: string;
  oldRole: string;
  newRole: string;
  createdAt: string;
}

export function AdminTeam() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<{ user: User; action: "ADMIN" | "ATTENDEE" } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchUsers = async (q = search): Promise<void> => {
    const res = await axios.get(`${API_URL}/admin/users`, { params: q ? { search: q } : {} });
    setUsers(res.data);
  };

  useEffect(() => {
    Promise.all([fetchUsers(), axios.get(`${API_URL}/admin/audit-log`)])
      .then(([, logsRes]) => setLogs(logsRes.data))
      .finally(() => setLoading(false));
  }, []);

  const handleRoleChange = async (target: User, action: "ADMIN" | "ATTENDEE") => {
    setPending(null);
    try {
      await axios.put(`${API_URL}/admin/users/${target.id}/role`, { role: action });
      const logsRes = await axios.get(`${API_URL}/admin/audit-log`);
      await fetchUsers();
      setLogs(logsRes.data);
      toast(
        action === "ADMIN"
          ? `ADMIN GRANTED · ${target.name}`
          : `ACCESS REVOKED · ${target.name} is now an attendee`,
        action === "ADMIN" ? "success" : "info"
      );
    } catch (err: any) {
      toast(err?.response?.data?.error || "Role change failed — check permissions", "error");
    }
  };

  // Keyboard: / → jump to the people search
  useShortcut("/", () => searchRef.current?.focus());

  const admins = users.filter((u) => u.role === "ADMIN");
  const attendees = users.filter((u) => u.role === "ATTENDEE");

  const renderSection = (kind: "admins" | "attendees") => {
    const list = kind === "admins" ? admins : attendees;
    const isAdmins = kind === "admins";
    return (
      <div className="paper-card overflow-hidden mb-10">
        <div className="bg-ink text-paper px-5 py-3 flex items-center gap-3">
          {isAdmins ? <Shield className="w-4 h-4 text-green" /> : <Users className="w-4 h-4 text-blue" />}
          <span className="label-mono text-[10px]">
            {isAdmins ? `THE TEAM · ${list.length} ADMIN${list.length === 1 ? "" : "S"}` : `EVERYONE ELSE · ${list.length} ATTENDEE${list.length === 1 ? "" : "S"}`}
          </span>
          {!isAdmins && (
            <span className="ml-auto label-mono text-[9px] text-ink-soft">REGULAR FOLKS — NO MANAGEMENT ACCESS</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="px-5 py-3 label-mono text-[10px] text-left text-ink-soft">Person</th>
                <th className="px-5 py-3 label-mono text-[10px] text-left text-ink-soft">Joined</th>
                <th className="px-5 py-3 label-mono text-[10px] text-right text-ink-soft">Action</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center font-mono text-xs uppercase tracking-widest text-ink-soft">
                    No {isAdmins ? "admins" : "attendees"} match this search
                  </td>
                </tr>
              )}
              {list.map((u, i) => {
                const isMe = u.email === user?.email;
                return (
                  <tr key={u.id} className={`border-b-2 border-dashed border-ink last:border-0 ${i % 2 === 1 ? "bg-paper-2/50" : ""}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange border-2 border-ink flex items-center justify-center font-display font-extrabold text-ink shrink-0">
                          {u.name[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div>
                          <p className="font-bold text-ink">
                            {u.name} {isMe && <span className="label-mono text-[9px] bg-blue text-paper px-1.5 py-0.5 ml-1">YOU</span>}
                            {isAdmins && isMe && <span className="label-mono text-[9px] text-orange ml-2">OWNER</span>}
                          </p>
                          <p className="font-mono text-xs text-ink-soft">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-ink-soft">
                      {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {!isMe &&
                        (isAdmins ? (
                          <button
                            onClick={() => setPending({ user: u, action: "ATTENDEE" })}
                            className="label-mono text-red hover:bg-red hover:text-paper transition-colors px-2 py-1 border-2 border-red flex items-center gap-1 ml-auto"
                          >
                            <ShieldOff className="w-3.5 h-3.5" /> Revoke Admin
                          </button>
                        ) : (
                          <button
                            onClick={() => setPending({ user: u, action: "ADMIN" })}
                            className="label-mono text-green hover:bg-green hover:text-ink transition-colors px-2 py-1 border-2 border-green flex items-center gap-1 ml-auto"
                          >
                            <Shield className="w-3.5 h-3.5" /> Grant Admin
                          </button>
                        ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 label-mono text-ink-soft hover:text-ink mb-8 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back
      </button>

      <header className="mb-10">
        <div className="flex items-center gap-4 mb-4">
          <span className="stamp text-orange">Owner's Desk</span>
          <span className="label-mono text-ink-soft">ROLE MANAGEMENT</span>
        </div>
        <h1 className="display text-5xl md:text-6xl mb-3">
          The <span className="bg-lime px-2 border-2 border-ink inline-block rotate-1">Team</span>
        </h1>
        <p className="text-ink-soft text-lg">
          Grant and revoke administrator access. Every change is written to the audit log.
        </p>
      </header>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-soft" />
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchUsers(search)}
          placeholder="Search people by name or email… (press /)"
          className="input !pl-12"
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 skeleton-stripes" />
          ))}
        </div>
      ) : (
        <>
          {renderSection("admins")}
          {renderSection("attendees")}
        </>
      )}

      {/* Audit log */}
      <div className="paper-card p-8">
        <h2 className="display text-2xl mb-6 flex items-center gap-3">
          <History className="w-5 h-5 text-orange" />
          Audit Log
        </h2>
        {logs.length === 0 ? (
          <p className="text-ink-soft">No role changes recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {logs.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-2 border-ink bg-paper-2 px-4 py-3">
                <UserCheck className="w-4 h-4 text-ink-soft shrink-0" />
                <span className="font-mono text-xs text-ink-soft">
                  {l.actorEmail}
                </span>
                <span className="label-mono text-[9px] text-ink-soft">changed</span>
                <span className="font-bold text-ink">{l.targetEmail}</span>
                <span className="font-mono text-xs">
                  <span className={l.oldRole === "ADMIN" ? "text-green font-bold" : "text-ink-soft"}>
                    {l.oldRole}
                  </span>
                  <span className="text-ink-soft mx-1">→</span>
                  <span className={l.newRole === "ADMIN" ? "text-green font-bold" : "text-ink-soft"}>
                    {l.newRole}
                  </span>
                </span>
                <span className="ml-auto font-mono text-[10px] text-ink-soft uppercase">
                  {new Date(l.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.action === "ADMIN" ? "Grant Administrator?" : "Revoke Administrator?"}
        message={
          pending
            ? pending.action === "ADMIN"
              ? `Grant full management access to ${pending.user.name}? They will be able to manage events, scan tickets, and view the admin ledger.`
              : `Strip admin access from ${pending.user.name}? They lose all admin routes immediately — the change is enforced live, per request.`
            : ""
        }
        confirmWord={pending?.action === "ADMIN" ? "admin" : "revoke"}
        confirmLabel={pending?.action === "ADMIN" ? "Grant Admin" : "Revoke Access"}
        destructive={pending?.action !== "ADMIN"}
        onConfirm={() => pending && handleRoleChange(pending.user, pending.action)}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
