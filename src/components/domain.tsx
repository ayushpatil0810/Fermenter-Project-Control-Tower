import { useState, type ReactNode } from "react";
import { AlertOctagon, CalendarClock, CheckCircle2, ClipboardList, FilePen, HardHat, Hammer, PackageCheck, Truck, ShieldCheck, Flag } from "lucide-react";
import { getUser, useDb } from "@/services/db";
import { navigate, ui } from "@/services/ui";
import type { Activity, Blocker, DB, Health, Project } from "@/types";
import { TODAY, addDays, cx, daysRemaining, dayLabel, diffDays, effectiveTaskStatus, fmtDate, fmtTs, inr, lakh, milestoneDelay, openBlockers, sevRank } from "@/utils";
import { Badge, Btn, DataTable, FilterSelect, Mono, Person, Progress, StatusBadge, Avatar, Input, type Col, type Tone, TONE_TEXT } from "./ui";

export const HealthBadge = ({ h }: { h: Health }) => <StatusBadge s={h} />;
export const ProjectLink = ({ id, className }: { id: string; className?: string }) => (
  <a href={`#/project/${id}`} onClick={(e) => e.stopPropagation()} className={cx("font-mono text-[12.5px] font-semibold text-brand hover:underline", className)}>{id}</a>
);
export const DaysChip = ({ date }: { date: string }) => {
  const d = daysRemaining(date);
  return <span className={cx("tnum whitespace-nowrap text-[13px] font-semibold", TONE_TEXT[d.tone])}>{d.text}</span>;
};

/* ---------- date filter ---------- */
export function useDateFilter() {
  const [mode, setMode] = useState("All");
  const [from, setFrom] = useState(TODAY);
  const [to, setTo] = useState(addDays(TODAY, 30));
  const test = (d: string) => {
    if (mode === "Today") return d === TODAY;
    if (mode === "This Week") return d >= TODAY && d <= addDays(TODAY, 7);
    if (mode === "This Month") return d.slice(0, 7) === TODAY.slice(0, 7);
    if (mode === "Custom") return d >= from && d <= to;
    return true;
  };
  const ui_ = (
    <>
      <FilterSelect label="Date" value={mode} onChange={setMode} options={["All", "Today", "This Week", "This Month", "Custom"]} />
      {mode === "Custom" && (
        <span className="flex items-center gap-1">
          <input aria-label="From date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 rounded-md border border-line px-1.5 text-[13px]" />
          <span className="text-mute">–</span>
          <input aria-label="To date" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 rounded-md border border-line px-1.5 text-[13px]" />
        </span>
      )}
    </>
  );
  return { test, ui: ui_, mode };
}

/* ---------- project table ---------- */
export function projectCols(db: DB, compact?: boolean): Col<Project>[] {
  const nb = (id: string) => openBlockers(db, id).length;
  const cols: Col<Project>[] = [
    { key: "id", header: "Project", sort: (p) => p.id, render: (p) => <div><ProjectLink id={p.id} />{compact && <div className="text-[12px] text-mute">{p.equipment}</div>}</div> },
    { key: "customer", header: "Customer", sort: (p) => p.customer, render: (p) => <span className="font-medium">{p.customer}</span> },
  ];
  if (!compact) cols.push(
    { key: "equipment", header: "Equipment", sort: (p) => p.equipment, render: (p) => p.equipment },
    { key: "cap", header: "Capacity", sort: (p) => p.capacity, render: (p) => <span className="tnum">{p.capacity.toLocaleString("en-IN")} L</span>, align: "right" },
    { key: "pm", header: "Project Manager", sort: (p) => getUser(p.pm)?.name ?? "", render: (p) => <Person id={p.pm} /> },
  );
  cols.push(
    { key: "stage", header: "Stage", sort: (p) => p.stage, render: (p) => <span className="whitespace-nowrap">{p.stage}</span> },
    { key: "progress", header: "Progress", sort: (p) => p.progress, className: "min-w-[130px]", render: (p) => <Progress value={p.progress} tone={p.health === "Blocked" ? "bad" : p.health === "At Risk" ? "warn" : "brand"} /> },
    { key: "health", header: "Health", sort: (p) => p.health, render: (p) => <HealthBadge h={p.health} /> },
    { key: "delivery", header: "Delivery", sort: (p) => p.delivery, render: (p) => <span className="tnum whitespace-nowrap">{fmtDate(p.delivery)} {p.delivery.slice(0, 4)}</span> },
  );
  if (!compact) cols.push(
    { key: "rem", header: "Days Remaining", sort: (p) => diffDays(TODAY, p.delivery), render: (p) => <DaysChip date={p.delivery} /> },
    { key: "blk", header: "Open Blockers", sort: (p) => nb(p.id), align: "right", render: (p) => (nb(p.id) ? <Badge tone={openBlockers(db, p.id).some((b) => b.severity === "Critical") ? "bad" : "warn"}>{nb(p.id)}</Badge> : <span className="text-mute">0</span>) },
    { key: "val", header: "Contract Value", sort: (p) => p.value, align: "right", render: (p) => <span className="tnum whitespace-nowrap">{inr(p.value)}</span> },
  );
  return cols;
}
export function ProjectTable({ rows, compact, empty }: { rows: Project[]; compact?: boolean; empty?: ReactNode }) {
  const db = useDb();
  return <DataTable rows={rows} cols={projectCols(db, compact)} rowKey={(p) => p.id} onRow={(p) => navigate(`project/${p.id}`)} empty={empty} />;
}

/* ---------- needs attention ---------- */
interface Att { key: string; sev: "Critical" | "High" | "Medium"; title: string; projectId: string; owner?: string; lines: [string, string][]; action: { label: string; run: () => void } }
export function buildAttention(db: DB, projectIds?: string[]): Att[] {
  const inScope = (id: string) => !projectIds || projectIds.includes(id);
  const out: Att[] = [];
  openBlockers(db).filter((b) => inScope(b.projectId) && (b.severity === "Critical" || b.severity === "High")).sort((a, b) => sevRank[a.severity] - sevRank[b.severity] || a.due.localeCompare(b.due)).forEach((b: Blocker) => {
    const v = db.vendors.find((x) => x.id === b.vendorId);
    const lines: [string, string][] = [];
    if (v) lines.push(["Vendor", v.name]);
    if (b.scheduleImpact) lines.push(["Impact", `Schedule +${b.scheduleImpact}d${b.costImpact ? ` · ${inr(b.costImpact)} exposure` : ""}`]);
    else lines.push(["Impact", b.impact]);
    lines.push(["Due", fmtDate(b.due)]);
    out.push({ key: b.id, sev: b.severity as "Critical" | "High", title: b.title, projectId: b.projectId, owner: b.owner, lines, action: { label: b.vendorId && b.severity === "Critical" ? "Escalate vendor" : b.category === "Customer" ? "Chase approval" : "Open blocker", run: () => ui({ blockerId: b.id }) } });
  });
  db.tasks.filter((t) => inScope(t.projectId) && effectiveTaskStatus(t) === "Overdue" && !db.blockers.some((b) => b.projectId === t.projectId && b.status !== "Resolved" && b.title.toLowerCase().includes(t.name.slice(0, 10).toLowerCase()))).sort((a, b) => a.due.localeCompare(b.due)).forEach((t) => {
    out.push({ key: t.id, sev: "High", title: `Overdue: ${t.name}`, projectId: t.projectId, owner: t.owner, lines: [["Due", `${fmtDate(t.due)} (${diffDays(t.due, TODAY)}d late)`], ["Status", t.status]], action: { label: "Open task", run: () => ui({ taskId: t.id }) } });
  });
  return out;
}
const SEV_STYLE = { Critical: { bar: "bg-bad", chip: "bad" as Tone }, High: { bar: "bg-[#e58a00]", chip: "warn" as Tone }, Medium: { bar: "bg-brand", chip: "brand" as Tone } };
export function AttentionList({ items }: { items: Att[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((a) => (
        <li key={a.key} className="relative flex gap-3 py-3 pl-4 pr-1 first:pt-1">
          <span className={cx("absolute bottom-3 left-0 top-3 w-1 rounded-full first:top-1", SEV_STYLE[a.sev].bar)} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge tone={SEV_STYLE[a.sev].chip}>{a.sev}</Badge>
              <ProjectLink id={a.projectId} />
              <span className="text-[12px] text-mute">· Owner: {getUser(a.owner)?.name ?? "—"}{getUser(a.owner) ? `, ${getUser(a.owner)!.title.split("—")[0].trim()}` : ""}</span>
            </div>
            <p className="mt-1 text-[15px] font-semibold leading-5">{a.title}</p>
            <p className="mt-0.5 text-[13px] text-mute">{a.lines.map(([k, v]) => `${k}: ${v}`).join("  ·  ")}</p>
          </div>
          <Btn size="sm" variant={a.sev === "Critical" ? "danger" : "secondary"} onClick={a.action.run} className="self-center">{a.action.label}</Btn>
        </li>
      ))}
    </ul>
  );
}

/* ---------- activity ---------- */
const KIND_ICON: Record<Activity["kind"], { i: ReactNode; c: string }> = {
  update: { i: <ClipboardList size={14} />, c: "bg-brand-soft text-brand" },
  blocker: { i: <AlertOctagon size={14} />, c: "bg-bad-soft text-bad" },
  vendor: { i: <Truck size={14} />, c: "bg-warn-soft text-warn" },
  material: { i: <PackageCheck size={14} />, c: "bg-ok-soft text-ok" },
  design: { i: <FilePen size={14} />, c: "bg-eng-soft text-eng" },
  field: { i: <HardHat size={14} />, c: "bg-warn-soft text-warn" },
  quality: { i: <ShieldCheck size={14} />, c: "bg-ok-soft text-ok" },
  milestone: { i: <Flag size={14} />, c: "bg-brand-soft text-brand" },
  task: { i: <CheckCircle2 size={14} />, c: "bg-idle-soft text-idle" },
};
export function ActivityItem({ a, showDay }: { a: Activity; showDay?: boolean }) {
  const k = KIND_ICON[a.kind];
  return (
    <li className="flex gap-3 py-2.5">
      <span className={cx("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", k.c)}>{k.i}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] leading-5">
          <b>{getUser(a.userId)?.name}</b> <span className="text-mute">{a.action}</span>
          {a.projectId && <> · <ProjectLink id={a.projectId} /></>}
        </p>
        <p className="text-[13.5px] text-ink/80">{a.description}</p>
      </div>
      <time className="shrink-0 text-[12px] font-medium text-mute">{showDay ? fmtTs(a.ts) : fmtTs(a.ts).replace("Yesterday ", "Y’day ")}</time>
    </li>
  );
}
export function ActivityList({ items, limit }: { items: Activity[]; limit?: number }) {
  const list = limit ? items.slice(0, limit) : items;
  return <ul className="divide-y divide-line">{list.map((a) => <ActivityItem key={a.id} a={a} />)}</ul>;
}
export function groupByDay(items: Activity[]) {
  const m = new Map<string, Activity[]>();
  items.forEach((a) => { const k = dayLabel(a.ts); m.set(k, [...(m.get(k) ?? []), a]); });
  return [...m.entries()];
}

/* ---------- milestones ---------- */
export function MilestoneList({ items, compact }: { items: DB["milestones"]; compact?: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((m) => {
        const d = milestoneDelay(m);
        const done = m.pct >= 100;
        return (
          <li key={m.id} className="flex items-center gap-3 py-2.5">
            <span className={cx("flex size-6 shrink-0 items-center justify-center rounded-full", done ? "bg-ok text-white" : m.pct > 0 ? "bg-brand text-white" : "bg-idle-soft text-idle")}>{done ? <CheckCircle2 size={14} /> : <CalendarClock size={13} />}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold leading-5">{m.name}{compact && <span className="font-normal text-mute"> · <ProjectLink id={m.projectId} /></span>}</p>
              <p className="text-[12.5px] text-mute">Planned {fmtDate(m.planned)} · {done ? `Actual ${fmtDate(m.actual)}` : `Forecast ${fmtDate(m.forecast)}`}</p>
            </div>
            {!done && m.pct > 0 && <span className="tnum text-[12.5px] font-semibold text-mute">{m.pct}%</span>}
            {d > 0 ? <Badge tone={d > 5 ? "bad" : "warn"}>+{d}d</Badge> : <Badge tone={done ? "ok" : "idle"}>{done ? "Done" : "On plan"}</Badge>}
          </li>
        );
      })}
    </ul>
  );
}

export const MiniStat = ({ k, v }: { k: string; v: ReactNode }) => (
  <div><p className="text-[11.5px] font-semibold uppercase tracking-wide text-mute">{k}</p><p className="text-[15px] font-semibold">{v}</p></div>
);
