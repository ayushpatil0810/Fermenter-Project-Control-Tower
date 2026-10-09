import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { AlertOctagon, AlertTriangle, CalendarCheck, CheckCircle2, Clock, Plus, Siren, Truck, FolderOpen, Hourglass } from "lucide-react";
import { getDashboardMetrics, getUser, useDb, useSession } from "@/services/db";
import { navigate, ui, openCopilot } from "@/services/ui";
import { STAGES } from "@/types";
import { TODAY, addDays, cx, effectiveTaskStatus, fmtDate, inr, lakh, milestoneDelay, riskScore, fmtDateY, daysFromToday } from "@/utils";
import { ActivityList, AttentionList, DaysChip, MilestoneList, ProjectLink, ProjectTable, buildAttention, useDateFilter } from "@/components/domain";
import { Badge, Btn, Empty, FilterSelect, Kpi, Loader, PageHeader, Panel, Progress, Seg, StatusBadge, TableSkeleton, Person, Mono, DataTable, type Col } from "@/components/ui";
import ShopFloor from "./ShopFloor";
import Field from "./Field";
import { updateWorkPackage } from "@/services/db";
import { toast } from "@/services/ui";

const HEALTH_COLORS = { "On Track": "#0f7d45", "At Risk": "#d98a00", Blocked: "#c02525" };

function HealthDonut({ m }: { m: ReturnType<typeof getDashboardMetrics> }) {
  const data = [
    { name: "On Track", value: m.onTrack },
    { name: "At Risk", value: m.atRisk },
    { name: "Blocked", value: m.blocked },
  ];
  const pct = (n: number) => (m.active ? Math.round((n / m.active) * 1000) / 10 : 0);
  return (
    <Panel title="Portfolio health" sub={`${m.active} active projects`}>
      <div className="flex items-center gap-4">
        <div className="relative size-[150px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none" isAnimationActive={false}>
                {data.map((d) => <Cell key={d.name} fill={HEALTH_COLORS[d.name as keyof typeof HEALTH_COLORS]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="tnum font-display text-[30px] font-semibold leading-8">{m.active}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-mute">projects</span>
          </div>
        </div>
        <ul className="flex-1 space-y-2">
          {data.map((d) => (
            <li key={d.name} className="flex items-center gap-2 text-[14px]">
              <span className="size-2.5 rounded-sm" style={{ background: HEALTH_COLORS[d.name as keyof typeof HEALTH_COLORS] }} />
              <span className="flex-1 font-medium">{d.name}</span>
              <span className="tnum text-mute">{d.value}</span>
              <span className="tnum w-14 text-right font-semibold">{pct(d.value)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

function RiskList({ ids }: { ids?: string[] }) {
  const db = useDb();
  const rows = db.projects.filter((p) => !ids || ids.includes(p.id)).map((p) => ({ p, r: riskScore(db, p) })).sort((a, b) => b.r.score - a.r.score).slice(0, 5);
  return (
    <Panel title="Project risk score" sub="0–100 · schedule, blockers, procurement, vendors" flush>
      <ul className="divide-y divide-line">
        {rows.map(({ p, r }) => (
          <li key={p.id}>
            <button onClick={() => navigate(`project/${p.id}/overview`)} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-paper">
              <Mono className="w-[84px] text-brand">{p.id}</Mono>
              <div className="flex-1"><Progress value={r.score} label={false} tone={r.score >= 65 ? "bad" : r.score >= 35 ? "warn" : "ok"} /></div>
              <span className="tnum w-8 text-right text-[15px] font-bold">{r.score}</span>
              <span className={cx("w-[88px] text-right text-[11px] font-bold", r.score >= 65 ? "text-bad" : r.score >= 35 ? "text-warn" : "text-ok")}>{r.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ProjectProgressPanel({ ids }: { ids?: string[] }) {
  const db = useDb();
  const [health, setHealth] = useState("All");
  const [stage, setStage] = useState("All");
  const date = useDateFilter();
  const rows = db.projects.filter((p) => (!ids || ids.includes(p.id)) && (health === "All" || p.health === health) && (stage === "All" || p.stage === stage) && date.test(p.delivery));
  return (
    <Panel
      title="Project progress"
      flush
      action={
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="Health" value={health} onChange={setHealth} options={["All", "On Track", "At Risk", "Blocked"]} />
          <FilterSelect label="Stage" value={stage} onChange={setStage} options={["All", ...STAGES]} />
          {date.ui}
        </div>
      }
    >
      <ProjectTable rows={rows} compact empty={<Empty title="No projects match" text="Adjust the health, stage or date filters to see more projects." action={<Btn onClick={() => { setHealth("All"); setStage("All"); }}>Clear filters</Btn>} icon={<FolderOpen size={22} />} />} />
    </Panel>
  );
}

function TasksDue({ ids, mine }: { ids?: string[]; mine?: string }) {
  const db = useDb();
  const rows = db.tasks.filter((t) => (!ids || ids.includes(t.projectId)) && (!mine || t.owner === mine) && t.status !== "Completed" && t.due <= TODAY).sort((a, b) => a.due.localeCompare(b.due));
  return (
    <Panel title="Tasks due & overdue" sub={`${rows.filter((r) => r.due === TODAY).length} due today · ${rows.filter((r) => r.due < TODAY).length} overdue`} flush>
      {rows.length === 0 ? <Empty title="Nothing due" text="No tasks are due today or overdue." /> : (
        <ul className="divide-y divide-line">
          {rows.map((t) => (
            <li key={t.id}>
              <button onClick={() => ui({ taskId: t.id })} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-paper">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{t.name}</p>
                  <p className="text-[12.5px] text-mute"><span className="font-mono">{t.projectId}</span> · {getUser(t.owner)?.name} · {t.due < TODAY ? `due ${fmtDate(t.due)}` : "due today"}</p>
                </div>
                <StatusBadge s={effectiveTaskStatus(t)} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function VendorDelays() {
  const db = useDb();
  const rows = db.workPackages.filter((w) => w.status === "Delayed");
  return (
    <Panel title="Vendor delays" sub={`${rows.length} work packages behind commitment`} flush>
      {rows.length === 0 ? <Empty title="No vendor delays" text="Every vendor is on its committed date." /> : (
        <ul className="divide-y divide-line">
          {rows.map((w) => {
            const v = db.vendors.find((x) => x.id === w.vendorId)!;
            const late = Math.round((new Date(w.forecast).getTime() - new Date(w.committed).getTime()) / 86400000);
            return (
              <li key={w.id}>
                <button onClick={() => navigate(`vendor/${v.id}`)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-paper">
                  <span className="flex size-8 items-center justify-center rounded-md bg-warn-soft text-warn"><Truck size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{v.name}</p>
                    <p className="truncate text-[12.5px] text-mute">{w.title} · <span className="font-mono">{w.projectId}</span></p>
                    <p className="text-[12.5px] text-mute">Promised {fmtDate(w.committed)} → revised {fmtDate(w.forecast)}</p>
                  </div>
                  <Badge tone="bad">+{late}d</Badge>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function Upcoming({ ids }: { ids?: string[] }) {
  const db = useDb();
  const rows = db.milestones.filter((m) => (!ids || ids.includes(m.projectId)) && m.pct < 100 && m.forecast <= addDays(TODAY, 14)).sort((a, b) => a.forecast.localeCompare(b.forecast)).slice(0, 6);
  return (
    <Panel title="Upcoming milestones" sub="Next 14 days, by forecast date">
      {rows.length ? <MilestoneList items={rows} compact /> : <Empty title="No milestones due" text="No milestones are forecast in the next two weeks." icon={<CalendarCheck size={22} />} />}
    </Panel>
  );
}

/* ---------- role dashboards ---------- */
function ManagerDashboard({ owner }: { owner: boolean }) {
  const db = useDb();
  const session = useSession()!;
  const user = getUser(session.userId)!;
  const [scope, setScope] = useState<"all" | "mine">("all");
  const ids = scope === "mine" ? db.projects.filter((p) => p.pm === user.id).map((p) => p.id) : undefined;
  const m = getDashboardMetrics(ids);
  const attention = buildAttention(db, ids);
  const go = (p: string) => () => navigate(p);

  return (
    <>
      <PageHeader
        title={`Good morning, ${user.name.split(" ")[0]}`}
        sub={owner ? "Portfolio health, delivery risk and exposure at a glance." : "Here’s what needs your attention today."}
        actions={
          <>
            {!owner && <Seg label="Scope" value={scope} onChange={setScope} options={[{ v: "all", l: "All projects" }, { v: "mine", l: "My projects" }]} />}
            <Btn variant="primary" onClick={() => ui({ quick: "menu" })}><Plus size={16} /> Quick Update</Btn>
          </>
        }
      />
      {m.criticalBlockers > 0 && (
        <button onClick={() => ui({ blockerId: db.blockers.find((b) => b.severity === "Critical" && b.status !== "Resolved")?.id })} className="mb-3 flex w-full items-center gap-3 rounded-lg border border-bad/30 bg-bad-soft px-4 py-2.5 text-left text-bad hover:bg-[#fbdcdc]">
          <Siren size={20} />
          <span className="flex-1 text-[15px] font-semibold">{m.criticalBlockers} Critical Blocker{m.criticalBlockers > 1 ? "s" : ""} — {db.blockers.find((b) => b.severity === "Critical" && b.status !== "Resolved")?.title}</span>
          <span className="text-[13px] font-semibold underline">Review now</span>
        </button>
      )}

      {owner ? (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi label="Revenue at risk" value={lakh(m.revenueAtRisk)} sub={`of ${lakh(m.portfolioValue)} portfolio`} tone="bad" icon={<AlertTriangle size={16} />} onClick={go("projects")} />
          <Kpi label="Active projects" value={m.active} sub={`${m.avgProgress}% avg. progress`} icon={<FolderOpen size={16} />} onClick={go("projects")} />
          <Kpi label="Milestone adherence" value={`${m.milestoneAdherence}%`} sub="on-time vs plan" tone="brand" icon={<CalendarCheck size={16} />} onClick={go("impact")} />
          <Kpi label="Major blockers" value={m.openBlockers} sub={`${m.criticalBlockers} critical`} tone="bad" icon={<AlertOctagon size={16} />} onClick={go("blockers")} />
          <Kpi label="Cost exposure" value={lakh(m.costExposure)} sub="open blockers" tone="warn" icon={<Hourglass size={16} />} onClick={go("blockers")} />
          <Kpi label="Vendor delays" value={m.vendorDelays} sub="vendors at risk" tone="warn" icon={<Truck size={16} />} onClick={go("vendors")} />
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          <Kpi label="Active Projects" value={m.active} icon={<FolderOpen size={16} />} onClick={go("projects")} />
          <Kpi label="On Track" value={m.onTrack} tone="ok" icon={<CheckCircle2 size={16} />} onClick={go("projects")} />
          <Kpi label="At Risk" value={m.atRisk} tone="warn" icon={<AlertTriangle size={16} />} onClick={go("projects")} />
          <Kpi label="Blocked" value={m.blocked} tone="bad" icon={<AlertOctagon size={16} />} onClick={go("projects")} />
          <Kpi label="Tasks Due Today" value={m.dueToday} tone="brand" icon={<Clock size={16} />} onClick={go("tasks")} />
          <Kpi label="Overdue Tasks" value={m.overdue} tone="bad" icon={<Hourglass size={16} />} onClick={go("tasks")} />
          <Kpi label="Open Blockers" value={m.openBlockers} tone="bad" sub={`${m.criticalBlockers} critical`} icon={<Siren size={16} />} onClick={go("blockers")} />
          <Kpi label="Vendor Delays" value={m.vendorDelays} tone="warn" icon={<Truck size={16} />} onClick={go("vendors")} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Needs attention" sub="Highest-priority exceptions, most severe first" className="lg:col-span-2" action={<Btn size="sm" variant="ghost" onClick={go("blockers")}>All blockers</Btn>}>
          {attention.length ? <AttentionList items={attention.slice(0, 5)} /> : <Empty title="No open blockers" text="All critical issues are currently resolved." />}
        </Panel>
        <div className="space-y-4"><HealthDonut m={m} /><RiskList ids={ids} /></div>
      </div>

      <div className="mt-4"><ProjectProgressPanel ids={ids} /></div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {!owner && <TasksDue ids={ids} />}
        <VendorDelays />
        <Upcoming ids={ids} />
        {owner && <Panel title="Recent updates" className="lg:col-span-1" flush><div className="px-4"><ActivityList items={db.activities.filter((a) => !ids || !a.projectId || ids.includes(a.projectId))} limit={5} /></div></Panel>}
      </div>
      {!owner && (
        <div className="mt-4">
          <Panel title="Recent updates" action={<Btn size="sm" variant="ghost" onClick={go("activity")}>Full feed</Btn>} flush>
            <div className="px-4"><ActivityList items={db.activities.filter((a) => !ids || !a.projectId || ids.includes(a.projectId))} limit={6} /></div>
          </Panel>
        </div>
      )}
    </>
  );
}

function DesignDashboard() {
  const db = useDb();
  const me = useSession()!.userId;
  const docs = db.documents.filter((d) => ["Under Review", "Pending Customer"].includes(d.status));
  const mine = db.tasks.filter((t) => t.owner === me && t.status !== "Completed");
  const engBlk = db.blockers.filter((b) => b.status !== "Resolved" && ["Engineering", "Customer", "Documentation"].includes(b.category));
  return (
    <>
      <PageHeader title="Engineering desk" sub="Drawings, revisions and customer approvals awaiting action." actions={<Btn variant="primary" onClick={() => ui({ quick: "menu" })}><Plus size={16} /> Quick Update</Btn>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="My open tasks" value={mine.length} tone="eng" />
        <Kpi label="Awaiting customer" value={docs.filter((d) => d.status === "Pending Customer").length} tone="warn" sub="drawing approvals" />
        <Kpi label="Under review" value={docs.filter((d) => d.status === "Under Review").length} tone="brand" />
        <Kpi label="Engineering blockers" value={engBlk.length} tone="bad" onClick={() => navigate("blockers")} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="My engineering tasks" flush>
          <ul className="divide-y divide-line">{mine.map((t) => (
            <li key={t.id}><button onClick={() => ui({ taskId: t.id })} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-paper"><div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold">{t.name}</p><p className="text-[12.5px] text-mute"><span className="font-mono">{t.projectId}</span> · due {fmtDate(t.due)}</p></div><StatusBadge s={effectiveTaskStatus(t)} /></button></li>
          ))}</ul>
        </Panel>
        <Panel title="Drawings & revisions in flight" flush>
          <ul className="divide-y divide-line">{docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-2.5"><div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold">{d.filename}</p><p className="text-[12.5px] text-mute">{d.type} · Rev {d.rev} · {d.projectId}</p></div><StatusBadge s={d.status} /></li>
          ))}</ul>
        </Panel>
        <Panel title="Engineering and approval blockers" className="lg:col-span-2" flush>
          <ul className="divide-y divide-line">{engBlk.map((b) => (
            <li key={b.id}><button onClick={() => ui({ blockerId: b.id })} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-paper"><StatusBadge s={b.severity} /><span className="flex-1 truncate text-[14px] font-semibold">{b.title}</span><ProjectLink id={b.projectId} /></button></li>
          ))}</ul>
        </Panel>
      </div>
    </>
  );
}

function ProcurementDashboard() {
  const db = useDb();
  const delayed = db.purchaseOrders.filter((o) => o.status === "Delayed");
  const open = db.purchaseOrders.filter((o) => !["Received", "Accepted"].includes(o.status));
  const cols: Col<(typeof db.vendors)[number]>[] = [
    { key: "n", header: "Vendor", sort: (v) => v.name, render: (v) => <a href={`#/vendor/${v.id}`} className="font-semibold text-brand hover:underline">{v.name}</a> },
    { key: "o", header: "On-time", sort: (v) => v.onTime, render: (v) => <span className="tnum font-semibold">{v.onTime}%</span> },
    { key: "h", header: "Health", render: (v) => <StatusBadge s={v.health} /> },
  ];
  return (
    <>
      <PageHeader title="Procurement desk" sub="Delayed materials, vendor reliability and open purchase orders." actions={<Btn variant="primary" onClick={() => ui({ quick: "menu" })}><Plus size={16} /> Quick Update</Btn>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Delayed materials" value={delayed.length} tone="bad" onClick={() => navigate("procurement")} />
        <Kpi label="Open purchase orders" value={open.length} tone="brand" onClick={() => navigate("procurement")} />
        <Kpi label="Vendors at risk" value={db.vendors.filter((v) => v.health === "At Risk").length} tone="warn" onClick={() => navigate("vendors")} />
        <Kpi label="Open PO value" value={lakh(open.reduce((s, o) => s + o.cost, 0))} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Delayed materials" className="lg:col-span-2" flush>
          <ul className="divide-y divide-line">{delayed.map((o) => (
            <li key={o.id} className="flex items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="text-[14px] font-semibold">{o.item}</p><p className="text-[12.5px] text-mute"><span className="font-mono">{o.projectId}</span> · {db.vendors.find((v) => v.id === o.vendorId)?.name} · needed {fmtDate(o.required)}, expected {fmtDate(o.expected)}</p></div><span className="tnum text-[13px] font-semibold">{inr(o.cost)}</span><StatusBadge s="Delayed" /></li>
          ))}</ul>
        </Panel>
        <Panel title="Vendor performance" flush><DataTable rows={db.vendors.slice(0, 6)} cols={cols} rowKey={(v) => v.id} dense /></Panel>
        <div className="lg:col-span-3"><TasksDue mine={useSession()!.userId} /></div>
      </div>
    </>
  );
}

function VendorPortal() {
  const db = useDb();
  const session = useSession()!;
  const vid = getUser(session.userId)?.vendorId ?? "v-pmw";
  const v = db.vendors.find((x) => x.id === vid)!;
  const wps = db.workPackages.filter((w) => w.vendorId === vid);
  return (
    <>
      <PageHeader title={v.name} sub="Vendor portal — your assigned work packages and delivery commitments." actions={<Btn variant="primary" onClick={() => ui({ quick: "menu" })}><Plus size={16} /> Quick Update</Btn>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Active work packages" value={wps.filter((w) => w.status !== "Delivered").length} tone="brand" />
        <Kpi label="Delayed" value={wps.filter((w) => w.status === "Delayed").length} tone="bad" />
        <Kpi label="On-time delivery" value={`${v.onTime}%`} tone={v.onTime >= 90 ? "ok" : "warn"} />
        <Kpi label="Delivered" value={wps.filter((w) => w.status === "Delivered").length} tone="ok" />
      </div>
      <div className="space-y-3">
        {wps.map((w) => (
          <Panel key={w.id} className={w.status === "Delayed" ? "border-bad/40" : ""}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-mute">{w.id} · {w.projectId}</p>
                <p className="text-[17px] font-semibold">{w.title}</p>
                <p className="mt-0.5 text-[13.5px] text-mute">Required {fmtDateY(w.committed)} · Forecast {fmtDateY(w.forecast)}{w.actual ? ` · Delivered ${fmtDate(w.actual)}` : ""}</p>
              </div>
              <StatusBadge s={w.status} />
            </div>
            {w.status !== "Delivered" && (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="text-[12px] font-semibold uppercase tracking-wide text-mute">Delivery forecast
                  <input type="date" value={w.forecast} onChange={(e) => { if (e.target.value) { updateWorkPackage(w.id, { forecast: e.target.value, status: e.target.value > w.committed ? "Delayed" : "In Progress" }); toast("Forecast updated. Procurement notified."); } }} className="mt-1 block h-9 rounded-md border border-line px-2 text-[14px] normal-case tracking-normal text-ink" />
                </label>
                <Btn variant="success" onClick={() => { updateWorkPackage(w.id, { status: "Delivered", actual: TODAY }); toast("Delivery confirmed."); }}>Confirm delivery</Btn>
                <Btn onClick={() => ui({ quick: "blocker" })}>Raise blocker</Btn>
                <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-line bg-white px-3 text-[14px] font-semibold hover:bg-paper">Upload evidence<input type="file" className="sr-only" onChange={(e) => e.target.files?.[0] && toast(`${e.target.files[0].name} uploaded as evidence.`)} /></label>
              </div>
            )}
          </Panel>
        ))}
      </div>
    </>
  );
}

export default function Dashboard() {
  const role = useSession()!.role;
  const body = useMemo(() => {
    switch (role) {
      case "Owner": return <ManagerDashboard owner />;
      case "Project Manager": return <ManagerDashboard owner={false} />;
      case "Design Engineer": return <DesignDashboard />;
      case "Procurement": return <ProcurementDashboard />;
      case "Shop Floor": return <ShopFloor dashboard />;
      case "Installation": return <Field dashboard />;
      default: return <VendorPortal />;
    }
  }, [role]);
  return <><div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-brand-soft p-3"><span className="font-semibold text-brand">Not sure where to start? Ask Fermenter Copilot.</span><Btn onClick={()=>openCopilot(undefined,"What should I do next?")}>Review my priorities</Btn></div>{role === "Shop Floor" || role === "Installation" ? body : <Loader>{body}</Loader>}</>;
}
