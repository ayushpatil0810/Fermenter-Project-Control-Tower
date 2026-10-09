import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity as ActivityIcon, AlertOctagon, BarChart3, Bell, CheckSquare, Container, FileText, FolderKanban, HardHat, LayoutDashboard, LogOut, Menu, Plus, Search, Settings, ShoppingCart, Truck, Wrench, X, Hammer,
} from "lucide-react";
import { getUser, login, logout, markAllRead, markRead, switchRole, useDb, useSession } from "@/services/db";
import { QUICK, QuickForm } from "@/components/forms";
import { BlockerDrawer, TaskDrawer } from "@/components/drawers";
import { BlockerForm, TaskForm } from "@/components/forms";
import { Avatar, Badge, Btn, Modal, Toasts } from "@/components/ui";
import { linkPath, navigate, ui, useRoute, useUI, type QuickKind } from "@/services/ui";
import { ROLES, type Role } from "@/types";
import { COMPANY } from "@/data/seed";
import { cx, fmtTs } from "@/utils";
import Copilot from "@/pages/Copilot";

const NAV: { page: string; label: string; icon: ReactNode; roles?: Role[] }[] = [
  { page: "copilot", label: "Fermenter Copilot", icon: <Wrench size={18} /> },
  { page: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { page: "projects", label: "Projects", icon: <FolderKanban size={18} />, roles: ["Owner", "Project Manager", "Design Engineer", "Procurement", "Shop Floor"] },
  { page: "tasks", label: "Tasks & Milestones", icon: <CheckSquare size={18} />, roles: ["Owner", "Project Manager", "Design Engineer", "Procurement", "Shop Floor", "Installation"] },
  { page: "blockers", label: "Blockers", icon: <AlertOctagon size={18} />, roles: ["Owner", "Project Manager", "Design Engineer", "Procurement", "Shop Floor", "Installation"] },
  { page: "vendors", label: "Vendors", icon: <Truck size={18} />, roles: ["Owner", "Project Manager", "Procurement"] },
  { page: "procurement", label: "Procurement", icon: <ShoppingCart size={18} />, roles: ["Owner", "Project Manager", "Procurement"] },
  { page: "shopfloor", label: "Shop Floor", icon: <Hammer size={18} />, roles: ["Owner", "Project Manager", "Shop Floor"] },
  { page: "field", label: "Field / Installation", icon: <HardHat size={18} />, roles: ["Owner", "Project Manager", "Installation"] },
  { page: "documents", label: "Documents", icon: <FileText size={18} /> },
  { page: "activity", label: "Activity Feed", icon: <ActivityIcon size={18} />, roles: ["Owner", "Project Manager", "Design Engineer", "Procurement", "Shop Floor", "Installation"] },
  { page: "impact", label: "Reports & Impact", icon: <BarChart3 size={18} />, roles: ["Owner", "Project Manager"] },
  { page: "settings", label: "Settings", icon: <Settings size={18} />, roles: ["Owner", "Project Manager", "Design Engineer", "Procurement", "Shop Floor", "Installation"] },
];
const BOTTOM: Record<Role, string[]> = {
  Owner: ["dashboard", "projects", "blockers", "impact"],
  "Project Manager": ["dashboard", "projects", "blockers", "tasks"],
  "Design Engineer": ["dashboard", "projects", "tasks", "documents"],
  Procurement: ["dashboard", "procurement", "vendors", "blockers"],
  "Shop Floor": ["dashboard", "shopfloor", "tasks", "blockers"],
  Installation: ["dashboard", "field", "tasks", "blockers"],
  Vendor: ["dashboard", "documents"],
};
export const allowedPages = (r: Role) => NAV.filter((n) => !n.roles || n.roles.includes(r)).map((n) => n.page);

export function Logo({ dark }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-md bg-brand text-white"><Container size={20} /></span>
      <div className="leading-none">
        <p className={cx("font-display text-[19px] font-semibold uppercase tracking-wider", dark ? "text-white" : "text-ink")}>Control Tower</p>
        <p className={cx("mt-0.5 text-[11px] font-medium uppercase tracking-widest", dark ? "text-[#8da2c0]" : "text-mute")}>Fermenter Projects</p>
      </div>
    </div>
  );
}

function NavList({ role, page, onGo, badge }: { role: Role; page: string; onGo?: () => void; badge: Record<string, number> }) {
  return (
    <nav aria-label="Main" className="space-y-0.5">
      {NAV.filter((n) => !n.roles || n.roles.includes(role)).map((n) => {
        const active = page === n.page || (n.page === "projects" && page === "project") || (n.page === "vendors" && page === "vendor");
        return (
          <a
            key={n.page}
            href={`#/${n.page}`}
            onClick={onGo}
            aria-current={active ? "page" : undefined}
            className={cx("flex h-10 items-center gap-3 rounded-md px-3 text-[14px] font-medium", active ? "bg-nav-2 text-white shadow-[inset_3px_0_0_#4d8bff]" : "text-[#a9b8cf] hover:bg-nav-2/60 hover:text-white")}
          >
            {n.icon}
            <span className="flex-1">{n.label}</span>
            {badge[n.page] ? <span className="rounded bg-bad px-1.5 text-[11px] font-bold text-white">{badge[n.page]}</span> : null}
          </a>
        );
      })}
    </nav>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const session = useSession()!;
  const db = useDb();
  const route = useRoute();
  const u = useUI();
  const user = getUser(session.userId)!;
  const unread = db.notifications.filter((n) => !n.read).length;
  const openB = db.blockers.filter((b) => b.status !== "Resolved");
  const badge = { blockers: openB.filter((b) => b.severity === "Critical").length };

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); ui({ search: true }); }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);

  return (
    <div className="flex min-h-full">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col bg-nav px-3 py-4 lg:flex">
        <div className="mb-5 px-2"><Logo dark /></div>
        <div className="scroll-thin flex-1 overflow-y-auto"><NavList role={session.role} page={route.page} badge={badge} /></div>
        <div className="mt-3 rounded-md bg-nav-2 p-3 text-[12px] leading-4 text-[#8da2c0]">
          <p className="font-semibold text-white">{COMPANY.name}</p>
          <p className="mt-0.5">{COMPANY.location}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-white px-3 sm:px-5">
          <Btn variant="ghost" className="lg:hidden" aria-label="Open menu" onClick={() => ui({ menu: true })}><Menu size={20} /></Btn>
          <div className="lg:hidden"><span className="font-display text-[18px] font-semibold uppercase tracking-wider">Control Tower</span></div>
          <button onClick={() => ui({ search: true })} className="hidden h-9 max-w-md flex-1 items-center gap-2 rounded-md border border-line bg-paper px-3 text-left text-[14px] text-mute hover:border-[#c4ccd9] sm:flex">
            <Search size={15} /> <span className="flex-1">Search projects, tasks, blockers, vendors…</span>
            <kbd className="rounded border border-line bg-white px-1.5 font-mono text-[11px]">Ctrl K</kbd>
          </button>
          <div className="flex-1 sm:hidden" />
          <Btn variant="ghost" className="sm:hidden" aria-label="Search" onClick={() => ui({ search: true })}><Search size={19} /></Btn>
          <Badge tone="warn" className="hidden !text-[11px] uppercase tracking-wider md:inline-flex">Demo mode</Badge>
          <label className="hidden items-center gap-2 text-[12px] text-mute md:flex">
            <span className="hidden xl:inline">Viewing as</span>
            <select aria-label="Viewing as role" value={session.role} onChange={(e) => { switchRole(e.target.value as Role); navigate("dashboard"); }} className="h-8 rounded-md border border-line bg-white px-2 text-[13px] font-semibold text-ink">
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <Btn variant="primary" onClick={() => ui({ quick: "menu" })} className="hidden sm:inline-flex"><Plus size={16} /> Quick Update</Btn>
          <Btn variant="ghost" className="relative" aria-label={`Notifications, ${unread} unread`} onClick={() => ui({ notif: !u.notif })}>
            <Bell size={19} />
            {unread > 0 && <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-bad text-[10px] font-bold text-white">{unread}</span>}
          </Btn>
          <div className="group relative">
            <button className="flex items-center gap-2 rounded-md p-1 hover:bg-paper" aria-label="Account menu"><Avatar id={user.id} size={30} /></button>
            <div className="invisible absolute right-0 top-full z-40 w-64 rounded-lg border border-line bg-white p-3 opacity-0 shadow-xl group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <p className="font-semibold">{user.name}</p>
              <p className="text-[13px] text-mute">{user.title}</p>
              <p className="mb-2 text-[12px] text-mute">{user.email}</p>
              <Btn className="w-full" onClick={() => logout()}><LogOut size={14} /> Sign out</Btn>
            </div>
          </div>
        </header>

        <div className="hidden items-center gap-2 border-b border-line bg-brand-soft px-5 py-1 text-[12.5px] text-brand md:flex">
          <span className="font-semibold">Viewing as {user.name} — {session.role}.</span>
          <span className="text-mute">All data is dummy demonstration data.</span>
        </div>

        <main id="main" className="min-w-0 flex-1 px-3 pb-44 pt-4 sm:px-5 md:pb-28 lg:px-6">
          <div className="mx-auto max-w-[1480px]">{children}</div>
        </main>
      </div>

      {/* mobile bottom nav */}
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {BOTTOM[session.role].slice(0, 2).map((p) => <BottomItem key={p} page={p} current={route.page} />)}
        <button onClick={() => ui({ quick: "menu" })} aria-label="Quick update" className="-mt-4 flex flex-col items-center justify-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand text-white shadow-lg"><Plus size={24} /></span>
        </button>
        {BOTTOM[session.role].slice(2, 4).map((p) => <BottomItem key={p} page={p} current={route.page} />)}
        {BOTTOM[session.role].length < 4 && <button onClick={() => ui({ menu: true })} className="flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold text-mute"><Menu size={20} />More</button>}
      </nav>

      {u.menu && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-nav/60" onClick={() => ui({ menu: false })} aria-hidden />
          <div className="slidein absolute inset-y-0 left-0 flex w-72 flex-col bg-nav p-3">
            <div className="mb-4 flex items-center justify-between px-2"><Logo dark /><button className="text-white" aria-label="Close menu" onClick={() => ui({ menu: false })}><X size={20} /></button></div>
            <div className="mb-3 px-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#8da2c0]">Viewing as
                <select value={session.role} onChange={(e) => { switchRole(e.target.value as Role); ui({ menu: false }); navigate("dashboard"); }} className="mt-1 h-9 w-full rounded-md border-0 bg-nav-2 px-2 text-[14px] font-semibold normal-case tracking-normal text-white">
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </label>
            </div>
            <div className="scroll-thin flex-1 overflow-y-auto"><NavList role={session.role} page={route.page} badge={badge} onGo={() => ui({ menu: false })} /></div>
            <Badge tone="warn" className="mt-2 self-start">DEMO MODE</Badge>
          </div>
        </div>
      )}

      <Overlays />
      <Copilot />
      <Toasts />
    </div>
  );
}

function BottomItem({ page, current }: { page: string; current: string }) {
  const n = NAV.find((x) => x.page === page)!;
  const active = current === page || (page === "projects" && current === "project");
  return (
    <a href={`#/${page}`} aria-current={active ? "page" : undefined} className={cx("flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold", active ? "text-brand" : "text-mute")}>
      {n.icon}
      {n.label.split(" ")[0]}
    </a>
  );
}

/* ---------- overlays ---------- */
function Overlays() {
  const u = useUI();
  return (
    <>
      <BlockerDrawer />
      <TaskDrawer />
      <QuickUpdate />
      <SearchDialog />
      <NotificationPanel />
      <Modal open={!!u.newTask} onClose={() => ui({ newTask: null })} title="New task">{u.newTask && <TaskForm projectId={u.newTask.projectId} onDone={() => ui({ newTask: null })} />}</Modal>
      <Modal open={!!u.newBlocker} onClose={() => ui({ newBlocker: null })} title="New blocker">{u.newBlocker && <BlockerForm projectId={u.newBlocker.projectId} onDone={() => ui({ newBlocker: null })} />}</Modal>
    </>
  );
}

function QuickUpdate() {
  const { quick } = useUI();
  const session = useSession()!;
  const [kind, setKind] = useState<QuickKind | null>(null);
  useEffect(() => { if (quick && quick !== "menu") setKind(quick); if (!quick) setKind(null); }, [quick]);
  const close = () => ui({ quick: null });
  const opts = QUICK.filter((q) => {
    if (session.role === "Shop Floor") return ["shop", "blocker", "task", "material"].includes(q.v);
    if (session.role === "Installation") return ["field", "blocker", "task"].includes(q.v);
    if (session.role === "Vendor") return ["vendor", "blocker"].includes(q.v);
    if (session.role === "Procurement") return ["vendor", "material", "blocker", "task", "progress"].includes(q.v);
    return true;
  });
  return (
    <Modal open={!!quick} onClose={close} title={kind ? `Quick update — ${QUICK.find((q) => q.v === kind)?.l}` : "Quick update"}>
      {!kind ? (
        <div>
          <p className="mb-3 text-[14px] text-mute">What do you want to update? A routine update takes under a minute.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {opts.map((q) => (
              <button key={q.v} onClick={() => setKind(q.v)} className="rounded-lg border border-line p-3 text-left hover:border-brand hover:bg-brand-soft">
                <p className="text-[15px] font-semibold">{q.l}</p>
                <p className="text-[13px] text-mute">{q.sub}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <button onClick={() => setKind(null)} className="mb-3 text-[13px] font-semibold text-brand hover:underline">← Change update type</button>
          <QuickForm kind={kind} onDone={close} />
        </div>
      )}
    </Modal>
  );
}

function SearchDialog() {
  const { search } = useUI();
  const db = useDb();
  const [q, setQ] = useState("");
  const close = () => { ui({ search: false }); setQ(""); };
  const res = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return null;
    const m = (...f: (string | undefined)[]) => f.join(" ").toLowerCase().includes(s);
    const vendorProjects = (vid: string) => db.workPackages.filter((w) => w.vendorId === vid).map((w) => w.projectId).join(" ");
    return {
      Projects: db.projects.filter((p) => m(p.id, p.customer, p.equipment, p.stage)).slice(0, 5).map((p) => ({ k: p.id, t: `${p.id} — ${p.customer}`, s: `${p.equipment} · ${p.stage}`, go: () => navigate(`project/${p.id}`) })),
      Tasks: db.tasks.filter((t) => m(t.id, t.name, t.projectId, t.workstream)).slice(0, 5).map((t) => ({ k: t.id, t: t.name, s: `${t.id} · ${t.projectId}`, go: () => ui({ taskId: t.id }) })),
      Blockers: db.blockers.filter((b) => m(b.id, b.title, b.projectId, b.description)).slice(0, 5).map((b) => ({ k: b.id, t: `${b.id} — ${b.title}`, s: `${b.projectId} · ${b.severity} · ${b.status}`, go: () => ui({ blockerId: b.id }) })),
      Vendors: db.vendors.filter((v) => m(v.name, v.services, v.location, vendorProjects(v.id))).slice(0, 5).map((v) => ({ k: v.id, t: v.name, s: `${v.location} · ${v.services}`, go: () => navigate(`vendor/${v.id}`) })),
      Documents: db.documents.filter((d) => m(d.filename, d.type, d.projectId)).slice(0, 5).map((d) => ({ k: d.id, t: d.filename, s: `${d.type} · Rev ${d.rev} · ${d.projectId}`, go: () => navigate("documents") })),
      Activity: db.activities.filter((a) => m(a.description, a.projectId, a.action)).slice(0, 5).map((a) => ({ k: a.id, t: a.description, s: `${getUser(a.userId)?.name} · ${fmtTs(a.ts)}`, go: () => navigate("activity") })),
    };
  }, [q, db]);
  if (!search) return null;
  const total = res ? Object.values(res).reduce((s, a) => s + a.length, 0) : 0;
  return (
    <div className="fixed inset-0 z-[65] flex items-start justify-center p-3 pt-[8vh]" onKeyDown={(e) => e.key === "Escape" && close()}>
      <div className="absolute inset-0 bg-nav/50" onClick={close} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Global search" className="fadeup relative flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search size={18} className="text-mute" />
          <input autoFocus aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try FER-24026, shaft, Precision…" className="h-12 flex-1 text-[16px] outline-none" />
          <Btn variant="ghost" size="sm" onClick={close} aria-label="Close search"><X size={16} /></Btn>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto p-2">
          {!res && <p className="px-3 py-6 text-center text-[14px] text-mute">Search across projects, tasks, blockers, vendors, documents and activity.</p>}
          {res && total === 0 && <p className="px-3 py-6 text-center text-[14px] text-mute">No results for “{q}”. Try a project number like FER-24026.</p>}
          {res && Object.entries(res).map(([g, items]) => items.length > 0 && (
            <div key={g} className="mb-2">
              <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-mute">{g} · {items.length}</p>
              {items.map((i) => (
                <button key={i.k} onClick={() => { close(); i.go(); }} className="flex w-full flex-col rounded-md px-3 py-1.5 text-left hover:bg-brand-soft">
                  <span className="truncate text-[14px] font-semibold">{i.t}</span>
                  <span className="truncate text-[12.5px] text-mute">{i.s}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NotificationPanel() {
  const { notif } = useUI();
  const db = useDb();
  if (!notif) return null;
  const close = () => ui({ notif: false });
  const dot = { critical: "bg-bad", warning: "bg-[#e58a00]", info: "bg-brand", success: "bg-ok" } as const;
  return (
    <div className="fixed inset-0 z-[55]" onKeyDown={(e) => e.key === "Escape" && close()}>
      <div className="absolute inset-0" onClick={close} aria-hidden />
      <div role="dialog" aria-label="Notifications" className="fadeup absolute right-2 top-14 flex max-h-[80vh] w-[min(420px,calc(100vw-1rem))] flex-col rounded-xl border border-line bg-white shadow-2xl sm:right-5">
        <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="font-display text-[18px] font-semibold uppercase tracking-wide">Notifications</h2>
          <Btn size="sm" variant="ghost" onClick={() => markAllRead()}>Mark all read</Btn>
        </header>
        <ul className="scroll-thin flex-1 divide-y divide-line overflow-y-auto">
          {db.notifications.map((n) => (
            <li key={n.id}>
              <button
                className={cx("flex w-full gap-3 px-4 py-3 text-left hover:bg-paper", !n.read && "bg-brand-soft/50")}
                onClick={() => {
                  markRead(n.id);
                  close();
                  if (n.link?.kind === "blocker") ui({ blockerId: n.link.id });
                  else if (n.link?.kind === "task") ui({ taskId: n.link.id });
                  else if (n.link) navigate(linkPath(n.link));
                }}
              >
                <span className={cx("mt-1.5 size-2.5 shrink-0 rounded-full", dot[n.tone])} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2"><b className="text-[14px]">{n.title}</b><span className="shrink-0 text-[12px] text-mute">{fmtTs(n.ts)}</span></span>
                  <span className="block text-[13.5px] text-mute">{n.body}</span>
                </span>
                {!n.read && <span className="sr-only">Unread</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
