import { useState } from "react";
import { ArrowLeft, Check, FileUp, Plus, Wand2 } from "lucide-react";
import { createDocument, getUser, updateMilestone, updateProject, useDb } from "@/services/db";
import { navigate, toast, ui, openCopilot } from "@/services/ui";
import { STAGES, type Project, type StageName } from "@/types";
import { TODAY, addDays, assessHealth, cx, diffDays, effectiveTaskStatus, fmtDate, fmtDateY, inr, milestoneDelay, openBlockers, poDelay, riskScore } from "@/utils";
import { ActivityList, DaysChip, HealthBadge, MiniStat, MilestoneList } from "@/components/domain";
import { Badge, Btn, DataTable, Empty, Input, Loader, Modal, Mono, PageHeader, PageSkeleton, Panel, Person, Progress, Select, StatusBadge, Tabs, Textarea, type Col } from "@/components/ui";

const TABS = ["overview", "timeline", "tasks", "procurement", "fabrication", "vendors", "documents", "issues", "activity"];
const LABEL: Record<string, string> = { overview: "Overview", timeline: "Timeline", tasks: "Tasks", procurement: "Procurement", fabrication: "Fabrication", vendors: "Vendors", documents: "Documents", issues: "Issues", activity: "Activity" };

function RiskCard({ p }: { p: Project }) {
  const db = useDb();
  const r = riskScore(db, p);
  const tone = r.score >= 65 ? "bad" : r.score >= 35 ? "warn" : "ok";
  const color = { bad: "text-bad", warn: "text-warn", ok: "text-ok" }[tone];
  return (
    <Panel title="Risk score" sub="Computed from live project data">
      <div className="flex items-end gap-3">
        <span className={cx("tnum font-display text-[52px] font-semibold leading-[48px]", color)}>{r.score}</span>
        <span className="mb-1 text-[13px] text-mute">/ 100</span>
        <Badge tone={tone} className="mb-1 ml-auto">{r.label}</Badge>
      </div>
      <Progress value={r.score} tone={tone} label={false} className="mt-3" />
      <h3 className="mb-1 mt-4 text-[11.5px] font-semibold uppercase tracking-wider text-mute">Contributing factors</h3>
      {r.factors.length === 0 ? <p className="text-[14px] text-mute">No risk factors detected.</p> : (
        <ul className="divide-y divide-line">
          {r.factors.map((f) => (
            <li key={f.label} className="flex items-center justify-between py-1.5 text-[14px]"><span>{f.label}</span><span className="tnum font-semibold text-bad">+{f.points}</span></li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Overview({ p }: { p: Project }) {
  const db = useDb();
  const auto = assessHealth(db, p);
  const [risk, setRisk] = useState(p.currentRisk ?? "");
  const [progress, setProgress] = useState(p.progress);
  const [health, setHealth] = useState(p.health);
  const [stage, setStage] = useState<string>(p.stage);
  const [note, setNote] = useState("");
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    updateProject(p.id, { progress, health, stage: stage as StageName, currentRisk: risk, healthReason: health !== p.health && note ? note : p.healthReason }, note || undefined);
    setNote("");
    toast("Project updated. Dashboard and activity feed refreshed.");
  };
  const open = openBlockers(db, p.id);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Panel title="Project information">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MiniStat k="Customer" v={p.customer} />
            <MiniStat k="Equipment" v={p.equipment} />
            <MiniStat k="Capacity" v={`${p.capacity.toLocaleString("en-IN")} L`} />
            <MiniStat k="Material" v={p.material} />
            <MiniStat k="Automation" v={p.automation} />
            <MiniStat k="Project manager" v={<Person id={p.pm} />} />
            <MiniStat k="Site" v={p.siteCity} />
            <MiniStat k="Contract value" v={inr(p.value)} />
            <MiniStat k="Start" v={fmtDateY(p.start)} />
            <MiniStat k="Delivery" v={fmtDateY(p.delivery)} />
            <MiniStat k="Days remaining" v={<DaysChip date={p.delivery} />} />
            <MiniStat k="Open blockers" v={open.length} />
          </div>
        </Panel>
        <Panel title="Health" sub="Why this project has its current status">
          <div className="flex flex-wrap items-center gap-3">
            <HealthBadge h={p.health} />
            <p className="min-w-0 flex-1 text-[14.5px]">{p.healthReason}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md bg-paper px-3 py-2 text-[13.5px]">
            <Wand2 size={16} className="text-brand" />
            <span className="flex-1"><b>Auto-assessment:</b> {auto.health}. {auto.reason}</span>
            {auto.health !== p.health && <Btn size="sm" variant="primary" onClick={() => { updateProject(p.id, { health: auto.health, healthReason: auto.reason }, "Applied suggested health."); toast(`Health set to ${auto.health}.`); }}>Apply suggested</Btn>}
          </div>
        </Panel>
        <Panel title="Update project" sub="Changes are logged to the activity feed">
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <Select label="Stage" value={stage} onChange={(e) => setStage(e.target.value)} options={[...STAGES]} />
            <Select label="Health" value={health} onChange={(e) => setHealth(e.target.value as Project["health"])} options={["On Track", "At Risk", "Blocked"]} />
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-mute" htmlFor="pg">Progress — {progress}%</label>
              <input id="pg" type="range" min={0} max={100} step={1} value={progress} onChange={(e) => setProgress(+e.target.value)} className="h-9 w-full accent-brand" />
            </div>
            <Textarea className="sm:col-span-2" label="Current risk" value={risk} onChange={(e) => setRisk(e.target.value)} placeholder="Agitator shaft delivery delayed by vendor." rows={2} />
            <Input className="sm:col-span-2" label="Update note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for the activity feed" />
            <div className="sm:col-span-2"><Btn variant="primary" type="submit"><Check size={16} /> Save update</Btn></div>
          </form>
        </Panel>
      </div>
      <div className="space-y-4">
        <RiskCard p={p} />
        {p.currentRisk && <Panel title="Current risk"><p className="text-[14.5px]">{p.currentRisk}</p></Panel>}
      </div>
    </div>
  );
}

function Pipeline({ p }: { p: Project }) {
  const db = useDb();
  const st = db.stages.filter((s) => s.projectId === p.id);
  return (
    <Panel title="Project pipeline" sub="11 stages from customer requirement to handover" flush>
      <ol className="scroll-thin flex gap-0 overflow-x-auto px-3 py-4">
        {st.map((s, i) => {
          const c = { Completed: "bg-ok text-white", "In Progress": "bg-brand text-white", Waiting: "bg-warn text-white", Blocked: "bg-bad text-white", Upcoming: "bg-idle-soft text-idle" }[s.status];
          return (
            <li key={s.name} className="relative min-w-[118px] flex-1 px-1 text-center">
              {i > 0 && <span className={cx("absolute right-1/2 top-[15px] h-0.5 w-full", s.status === "Upcoming" ? "bg-line" : "bg-ok")} aria-hidden />}
              <span className={cx("relative mx-auto flex size-8 items-center justify-center rounded-full text-[13px] font-bold", c)}>{s.status === "Completed" ? <Check size={16} /> : i + 1}</span>
              <p className="mt-1.5 text-[12.5px] font-semibold leading-4">{s.name}</p>
              <p className="text-[11.5px] text-mute">{s.status}{s.status === "In Progress" || s.status === "Waiting" || s.status === "Blocked" ? ` · ${s.pct}%` : ""}</p>
              <p className="text-[11.5px] text-mute">{fmtDate(s.actual ?? s.planned)}</p>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function Gantt({ p }: { p: Project }) {
  const db = useDb();
  const ms = db.milestones.filter((m) => m.projectId === p.id);
  const lo = p.start < ms[0]?.planned ? p.start : ms[0]?.planned ?? p.start;
  const hi = addDays([p.delivery, ...ms.map((m) => m.forecast)].sort().at(-1)!, 10);
  const span = Math.max(1, diffDays(lo, hi));
  const x = (d: string) => `${Math.max(0, Math.min(100, (diffDays(lo, d) / span) * 100))}%`;
  const months: string[] = [];
  for (let d = lo.slice(0, 7) + "-01"; d <= hi; d = addDays(d.slice(0, 7) + "-28", 5).slice(0, 7) + "-01") months.push(d);
  return (
    <Panel title="Milestone timeline" sub="Hollow marker = planned · solid bar = forecast · red = slippage">
      <div className="scroll-thin overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="relative ml-44 h-6 border-b border-line text-[11.5px] font-semibold text-mute">
            {months.map((m) => <span key={m} className="absolute" style={{ left: x(m) }}>{fmtDate(m).split(" ")[1]}</span>)}
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-44 right-0">
              <div className="absolute inset-y-0 w-px bg-brand" style={{ left: x(TODAY) }}><span className="absolute -top-0 left-1 text-[10.5px] font-bold text-brand">Today</span></div>
            </div>
            {ms.map((m) => {
              const d = milestoneDelay(m);
              const bar = m.pct >= 100 ? "bg-ok" : d > 5 ? "bg-bad" : d > 0 ? "bg-warn" : "bg-brand";
              return (
                <div key={m.id} className="relative flex h-10 items-center border-b border-line last:border-0">
                  <div className="w-44 shrink-0 pr-2"><p className="truncate text-[13.5px] font-semibold">{m.name}</p><p className="text-[11.5px] text-mute">{m.pct}% · {d > 0 ? `+${d}d slip` : "on plan"}</p></div>
                  <div className="relative h-full flex-1">
                    <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-ink bg-white" style={{ left: x(m.planned) }} title={`Planned ${fmtDate(m.planned)}`} />
                    <span className={cx("absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full", bar)} style={{ left: x(m.planned), width: `max(10px, calc(${x(m.forecast)} - ${x(m.planned)}))` }} title={`Forecast ${fmtDate(m.forecast)}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Timeline({ p }: { p: Project }) {
  const db = useDb();
  const ms = db.milestones.filter((m) => m.projectId === p.id);
  const [edit, setEdit] = useState<string>();
  const m = ms.find((x) => x.id === edit);
  const [fc, setFc] = useState("");
  return (
    <div className="space-y-4">
      <Pipeline p={p} />
      <Gantt p={p} />
      <Panel title="Milestones" flush>
        <ul className="divide-y divide-line px-4">
          {ms.map((x) => (
            <li key={x.id} className="flex items-center gap-2">
              <div className="flex-1"><MilestoneList items={[x]} /></div>
              {x.pct < 100 && <Btn size="sm" onClick={() => { setEdit(x.id); setFc(x.forecast); }}>Revise forecast</Btn>}
            </li>
          ))}
        </ul>
      </Panel>
      <Modal open={!!m} onClose={() => setEdit(undefined)} title="Revise forecast" footer={<><Btn onClick={() => setEdit(undefined)}>Cancel</Btn><Btn variant="primary" onClick={() => { updateMilestone(m!.id, { forecast: fc }); toast("Milestone forecast updated."); setEdit(undefined); }}>Save forecast</Btn></>}>
        {m && <div className="space-y-3"><p className="text-[14px]"><b>{m.name}</b> was planned for {fmtDateY(m.planned)}.</p><Input label="New forecast date" type="date" value={fc} onChange={(e) => setFc(e.target.value)} /></div>}
      </Modal>
    </div>
  );
}

function TasksTab({ p }: { p: Project }) {
  const db = useDb();
  const rows = db.tasks.filter((t) => t.projectId === p.id);
  const cols: Col<(typeof rows)[number]>[] = [
    { key: "n", header: "Task", sort: (t) => t.name, render: (t) => <span className="font-semibold">{t.name}</span> },
    { key: "o", header: "Owner", sort: (t) => getUser(t.owner)?.name ?? "", render: (t) => <Person id={t.owner} /> },
    { key: "p", header: "Priority", sort: (t) => t.priority, render: (t) => <StatusBadge s={t.priority} /> },
    { key: "s", header: "Status", sort: (t) => effectiveTaskStatus(t), render: (t) => <StatusBadge s={effectiveTaskStatus(t)} /> },
    { key: "d", header: "Due", sort: (t) => t.due, render: (t) => fmtDate(t.due) },
  ];
  return (
    <Panel title={`${rows.length} tasks`} flush action={<Btn size="sm" variant="primary" onClick={() => ui({ newTask: { projectId: p.id } })}><Plus size={14} /> Add task</Btn>}>
      <DataTable rows={rows} cols={cols} rowKey={(t) => t.id} onRow={(t) => ui({ taskId: t.id })} empty={<Empty title="No tasks yet" text="Add the first task for this project." />} initialSort={{ key: "d", dir: 1 }} />
    </Panel>
  );
}

function ProcTab({ p }: { p: Project }) {
  const db = useDb();
  const rows = db.purchaseOrders.filter((o) => o.projectId === p.id);
  const cols: Col<(typeof rows)[number]>[] = [
    { key: "i", header: "Item", sort: (o) => o.item, render: (o) => <span className="font-semibold">{o.item}</span> },
    { key: "v", header: "Vendor", render: (o) => db.vendors.find((v) => v.id === o.vendorId)?.name },
    { key: "po", header: "PO", render: (o) => <Mono>{o.po}</Mono> },
    { key: "r", header: "Required", sort: (o) => o.required, render: (o) => fmtDate(o.required) },
    { key: "e", header: "Expected", sort: (o) => o.expected, render: (o) => fmtDate(o.expected) },
    { key: "d", header: "Delay", sort: (o) => poDelay(o), render: (o) => (poDelay(o) > 0 ? <Badge tone="bad">+{poDelay(o)}d</Badge> : <span className="text-mute">—</span>) },
    { key: "s", header: "Status", render: (o) => <StatusBadge s={o.status} /> },
  ];
  return <Panel title="Purchase orders" flush><DataTable rows={rows} cols={cols} rowKey={(o) => o.id} rowClass={(o) => (poDelay(o) > 0 ? "bg-bad-soft/40" : "")} empty={<Empty title="No purchase orders" text="Nothing has been ordered for this project yet." />} /></Panel>;
}

function FabTab({ p }: { p: Project }) {
  const db = useDb();
  const jobs = db.shopJobs.filter((j) => j.projectId === p.id);
  const ups = db.shopUpdates.filter((u) => u.projectId === p.id);
  const stages = db.stages.filter((s) => s.projectId === p.id && ["Fabrication", "Assembly", "FAT / Inspection"].includes(s.name));
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel title="Fabrication stages" className="lg:col-span-1">
        <ul className="space-y-3">{stages.map((s) => (
          <li key={s.name}><div className="mb-1 flex justify-between text-[14px]"><b>{s.name}</b><StatusBadge s={s.status} /></div><Progress value={s.pct} /></li>
        ))}</ul>
      </Panel>
      <Panel title="Shop-floor jobs" className="lg:col-span-2" flush>
        {jobs.length === 0 ? <Empty title="No active jobs" text="No shop-floor jobs are scheduled for this project." /> : (
          <ul className="divide-y divide-line">{jobs.map((j) => (
            <li key={j.id} className="flex items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="font-semibold">{j.name}</p><p className="text-[12.5px] text-mute">{j.station} · {j.hours}h · QC: {j.qc}</p></div><div className="w-32"><Progress value={j.progress} /></div><StatusBadge s={j.status} /></li>
          ))}</ul>
        )}
      </Panel>
      <Panel title="Recent shop-floor updates" className="lg:col-span-3" flush>
        {ups.length === 0 ? <Empty title="No updates logged" text="Updates submitted from the shop floor appear here." /> : (
          <ul className="divide-y divide-line">{ups.map((u) => <li key={u.id} className="px-4 py-2.5 text-[14px]"><b>{getUser(u.userId)?.name}</b> · {u.status} {u.progress}% — {u.comment}</li>)}</ul>
        )}
      </Panel>
    </div>
  );
}

function VendorsTab({ p }: { p: Project }) {
  const db = useDb();
  const wps = db.workPackages.filter((w) => w.projectId === p.id);
  return (
    <Panel title="Vendor work packages" flush>
      {wps.length === 0 ? <Empty title="No vendors assigned" text="Vendor work packages for this project will appear here." /> : (
        <ul className="divide-y divide-line">{wps.map((w) => {
          const v = db.vendors.find((x) => x.id === w.vendorId)!;
          return (
            <li key={w.id}><button onClick={() => navigate(`vendor/${v.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper">
              <div className="min-w-0 flex-1"><p className="font-semibold">{v.name}</p><p className="text-[13px] text-mute">{w.title} · committed {fmtDate(w.committed)} · forecast {fmtDate(w.forecast)}</p></div>
              <span className="tnum text-[13px] font-semibold">{v.onTime}% on-time</span><StatusBadge s={w.status} />
            </button></li>
          );
        })}</ul>
      )}
    </Panel>
  );
}

function DocsTab({ p }: { p: Project }) {
  const db = useDb();
  const docs = db.documents.filter((d) => d.projectId === p.id);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ filename: "", type: "GA Drawing", rev: "A" });
  return (
    <>
      <Panel title={`${docs.length} documents`} flush action={<Btn size="sm" variant="primary" onClick={() => setOpen(true)}><FileUp size={14} /> Upload</Btn>}>
        {docs.length === 0 ? <Empty title="No documents" text="Upload drawings, certificates and reports." /> : (
          <ul className="divide-y divide-line">{docs.map((d) => {
            const latest = !db.documents.some((x) => x.series === d.series && x.projectId === d.projectId && x.rev > d.rev);
            return <li key={d.id} className={cx("flex items-center gap-3 px-4 py-2.5", latest && d.status !== "Superseded" && "bg-brand-soft/40")}><div className="min-w-0 flex-1"><p className="truncate font-semibold">{d.filename}</p><p className="text-[12.5px] text-mute">{d.type} · Rev {d.rev} · {getUser(d.by)?.name} · {fmtDate(d.date)}</p></div>{latest && d.status !== "Superseded" && <Badge tone="brand">Latest</Badge>}<StatusBadge s={d.status} /></li>;
          })}</ul>
        )}
      </Panel>
      <Modal open={open} onClose={() => setOpen(false)} title="Upload document" footer={<><Btn onClick={() => setOpen(false)}>Cancel</Btn><Btn variant="primary" type="submit" form="up-form">Upload</Btn></>}>
        <form id="up-form" className="space-y-3" onSubmit={(e) => { e.preventDefault(); createDocument({ filename: f.filename, type: f.type, rev: f.rev, projectId: p.id, series: f.filename.split("_")[0] || f.type, status: "Under Review" }); toast("Document uploaded."); setOpen(false); }}>
          <Input label="File name" required value={f.filename} onChange={(e) => setF({ ...f, filename: e.target.value })} placeholder="GA_FER-24026_RevD.pdf" />
          <Select label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={["GA Drawing", "Fabrication Drawing", "P&ID", "BOM", "Inspection Report", "Welding Record", "FAT Report", "Installation Report"]} />
          <Input label="Revision" required value={f.rev} onChange={(e) => setF({ ...f, rev: e.target.value })} />
        </form>
      </Modal>
    </>
  );
}

function IssuesTab({ p }: { p: Project }) {
  const db = useDb();
  const rows = db.blockers.filter((b) => b.projectId === p.id);
  return (
    <Panel title={`${rows.filter((b) => b.status !== "Resolved").length} open · ${rows.length} total`} flush action={<Btn size="sm" variant="primary" onClick={() => ui({ newBlocker: { projectId: p.id } })}><Plus size={14} /> Raise blocker</Btn>}>
      {rows.length === 0 ? <Empty title="No open blockers" text="Nothing is holding this project up." /> : (
        <ul className="divide-y divide-line">{rows.map((b) => (
          <li key={b.id}><button onClick={() => ui({ blockerId: b.id })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper"><StatusBadge s={b.severity} /><div className="min-w-0 flex-1"><p className="font-semibold">{b.title}</p><p className="text-[12.5px] text-mute"><Mono>{b.id}</Mono> · {b.category} · owner {getUser(b.owner)?.name} · due {fmtDate(b.due)}</p></div><StatusBadge s={b.status} /></button></li>
        ))}</ul>
      )}
    </Panel>
  );
}

export default function ProjectDetail({ id, tab }: { id: string; tab?: string }) {
  const db = useDb();
  const p = db.projects.find((x) => x.id === id);
  const t = tab && TABS.includes(tab) ? tab : "overview";
  if (!p) return <Empty title="Project not found" text={`No project with ID ${id} exists.`} action={<Btn variant="primary" onClick={() => navigate("projects")}>Back to projects</Btn>} />;
  const counts: Record<string, number | undefined> = {
    tasks: db.tasks.filter((x) => x.projectId === id).length,
    issues: openBlockers(db, id).length,
    documents: db.documents.filter((x) => x.projectId === id).length,
  };
  return (
    <>
      <PageHeader
        crumb={<button onClick={() => navigate("projects")} className="mb-1 flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline"><ArrowLeft size={14} /> All projects</button>}
        title={<span className="flex flex-wrap items-center gap-3"><span className="font-mono text-[26px]">{p.id}</span><HealthBadge h={p.health} /></span>}
        sub={`${p.customer} · ${p.equipment} · ${p.stage} · ${p.progress}% complete`}
        actions={<><Btn onClick={() => openCopilot(p.id, `${p.id} project status`)}>Ask Copilot</Btn><Btn onClick={() => ui({ newBlocker: { projectId: p.id } })}>Raise blocker</Btn><Btn variant="primary" onClick={() => ui({ newTask: { projectId: p.id } })}><Plus size={16} /> Add task</Btn></>}
      />
      <Tabs tabs={TABS.map((v) => ({ v, l: LABEL[v], n: counts[v] }))} value={t} onChange={(v) => navigate(`project/${id}/${v}`)} />
      <div className="mt-4">
        <Loader skeleton={<PageSkeleton />}>
          {t === "overview" && <Overview key={`${p.id}${p.progress}${p.health}${p.stage}${p.currentRisk ?? ""}`} p={p} />}
          {t === "timeline" && <Timeline p={p} />}
          {t === "tasks" && <TasksTab p={p} />}
          {t === "procurement" && <ProcTab p={p} />}
          {t === "fabrication" && <FabTab p={p} />}
          {t === "vendors" && <VendorsTab p={p} />}
          {t === "documents" && <DocsTab p={p} />}
          {t === "issues" && <IssuesTab p={p} />}
          {t === "activity" && <Panel title="Project activity"><ActivityList items={db.activities.filter((a) => a.projectId === id)} /></Panel>}
        </Loader>
      </div>
    </>
  );
}
