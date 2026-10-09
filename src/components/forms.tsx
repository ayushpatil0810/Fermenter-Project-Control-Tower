import { useState } from "react";
import { Camera, CheckCircle2, MapPin, Send } from "lucide-react";
import { users } from "@/data/seed";
import { createBlocker, createFieldUpdate, createShopUpdate, createTask, receiveMaterial, updateProject, updateTask, updateWorkPackage, useDb, addComment } from "@/services/db";
import { toast } from "@/services/ui";
import type { BlockerCategory, Priority, TaskStatus } from "@/types";
import { TODAY, cx, fmtDate, fmtTs, NOW_TS } from "@/utils";
import { Btn, Input, PhotoUpload, Select, Textarea, Field } from "./ui";

export const userOptions = users.map((u) => ({ v: u.id, l: `${u.name} — ${u.title}` }));
const CATS: BlockerCategory[] = ["Engineering", "Procurement", "Vendor", "Material", "Fabrication", "Quality", "Customer", "Installation", "Logistics", "Documentation"];
const PRIOS: Priority[] = ["Critical", "High", "Medium", "Low"];
const TSTAT: TaskStatus[] = ["Not Started", "In Progress", "Waiting", "Blocked", "Completed"];

export function useProjectOptions() {
  const db = useDb();
  return db.projects.map((p) => ({ v: p.id, l: `${p.id} — ${p.customer}` }));
}

export function Radios({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <fieldset>
      <legend className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-mute">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <label key={o} className={cx("flex min-h-10 cursor-pointer items-center rounded-md border px-3 text-[14px] font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand", value === o ? "border-brand bg-brand-soft text-brand" : "border-line bg-white text-ink hover:bg-paper")}>
            <input type="radio" name={label} className="sr-only" checked={value === o} onChange={() => onChange(o)} />
            {o}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SubmitBar({ label, disabled }: { label: string; disabled?: boolean }) {
  return (
    <Btn variant="primary" size="lg" type="submit" disabled={disabled} className="w-full">
      <Send size={16} /> {label}
    </Btn>
  );
}

/* ---------- shop floor ---------- */
export function ShopUpdateForm({ jobId, onDone }: { jobId?: string; onDone?: () => void }) {
  const db = useDb();
  const [job, setJob] = useState(jobId ?? db.shopJobs[0]?.id ?? "");
  const j = db.shopJobs.find((x) => x.id === job);
  const [status, setStatus] = useState("In Progress");
  const [progress, setProgress] = useState(j?.progress ?? 0);
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!j) return;
        createShopUpdate({ jobId: j.id, projectId: j.projectId, status, progress: status === "Completed" ? 100 : progress, comment: comment || "Update logged.", photo });
        toast(`Update submitted for ${j.projectId}. Activity feed updated.`);
        setComment("");
        onDone?.();
      }}
    >
      <Select label="Project / Task" value={job} onChange={(e) => { setJob(e.target.value); setProgress(db.shopJobs.find((x) => x.id === e.target.value)?.progress ?? 0); }} options={db.shopJobs.map((x) => ({ v: x.id, l: `${x.projectId} — ${x.name}` }))} />
      <Radios label="Status" value={status} onChange={setStatus} options={["Started", "In Progress", "Completed", "Blocked"]} />
      <Field label={`Progress — ${status === "Completed" ? 100 : progress}%`}>
        {(id) => <input id={id} type="range" min={0} max={100} step={5} value={status === "Completed" ? 100 : progress} onChange={(e) => setProgress(+e.target.value)} className="h-9 w-full accent-brand" />}
      </Field>
      <Textarea label="Comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Longitudinal weld completed. Visual inspection pending." />
      <PhotoUpload onChange={setPhoto} />
      <SubmitBar label="Submit Update" />
    </form>
  );
}

/* ---------- field ---------- */
export function FieldUpdateForm({ projectId, onDone }: { projectId?: string; onDone?: () => void }) {
  const db = useDb();
  const [pid, setPid] = useState(projectId ?? db.siteJobs[0]?.projectId ?? "");
  const [status, setStatus] = useState("Work in progress");
  const [issue, setIssue] = useState("None");
  const [sev, setSev] = useState<Priority | "None">("None");
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState(false);
  const [raise, setRaise] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!comment.trim()) return toast("Add a short comment before submitting.", "bad");
        const doRaise = raise && issue !== "None";
        createFieldUpdate({ projectId: pid, status: issue !== "None" ? "Issue raised" : status, issueType: issue, severity: issue === "None" ? "None" : sev === "None" ? "Medium" : sev, comment, photo, gps: "18.5642° N, 73.8021° E" }, doRaise);
        toast(doRaise ? "Field update submitted and blocker raised." : "Field update submitted.");
        setComment("");
        setRaise(false);
        onDone?.();
      }}
    >
      <Select label="Site job" value={pid} onChange={(e) => setPid(e.target.value)} options={db.siteJobs.map((s) => ({ v: s.projectId, l: `${s.projectId} — ${s.customer}` }))} />
      <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={["Arrived on site", "Work in progress", "Work completed", "Awaiting customer", "Customer sign-off received"]} />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Issue type" value={issue} onChange={(e) => { setIssue(e.target.value); if (e.target.value === "None") setRaise(false); else if (sev === "None") setSev("High"); }} options={["None", "Foundation / civil", "Utilities not ready", "Damage in transit", "Safety concern", "Instrument fault", "Customer readiness"]} />
        <Select label="Severity" value={sev} onChange={(e) => setSev(e.target.value as Priority)} disabled={issue === "None"} options={["None", ...PRIOS]} />
      </div>
      <Textarea label="Comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Two anchor bolts are approximately 12 mm out of alignment." />
      <PhotoUpload onChange={setPhoto} />
      <div className="flex items-center justify-between rounded-md bg-paper px-3 py-2 text-[12.5px] text-mute">
        <span className="flex items-center gap-1.5"><MapPin size={14} /> GPS placeholder: 18.5642° N, 73.8021° E</span>
        <span className="tnum">{fmtTs(NOW_TS)}</span>
      </div>
      {issue !== "None" && (
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border border-bad/30 bg-bad-soft px-3 text-[14px] font-semibold text-bad">
          <input type="checkbox" checked={raise} onChange={(e) => setRaise(e.target.checked)} className="size-4 accent-[#c02525]" />
          Raise blocker for this issue
        </label>
      )}
      <SubmitBar label={raise ? "Submit and Raise Blocker" : "Submit Field Update"} />
    </form>
  );
}

/* ---------- blocker ---------- */
export function BlockerForm({ projectId, onDone }: { projectId?: string; onDone?: (id: string) => void }) {
  const projects = useProjectOptions();
  const [f, setF] = useState({ projectId: projectId ?? projects[0].v, title: "", category: "Vendor" as BlockerCategory, severity: "High" as Priority, owner: "u-sj", due: TODAY, description: "", cost: "", days: "" });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!f.title.trim()) return toast("Give the blocker a short title.", "bad");
        const id = createBlocker({ projectId: f.projectId, title: f.title, category: f.category, severity: f.severity, owner: f.owner, due: f.due, description: f.description, costImpact: +f.cost || 0, scheduleImpact: +f.days || 0, impact: f.description || "Impact under assessment." });
        toast(`${id} created${f.severity === "Critical" ? " — critical alert sent" : ""}.`);
        onDone?.(id);
      }}
    >
      <Select label="Project" value={f.projectId} onChange={(e) => set("projectId", e.target.value)} options={projects} />
      <Input label="Title" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Agitator shaft machining delayed" />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Category" value={f.category} onChange={(e) => set("category", e.target.value)} options={CATS} />
        <Select label="Severity" value={f.severity} onChange={(e) => set("severity", e.target.value)} options={PRIOS} />
        <Select label="Owner" value={f.owner} onChange={(e) => set("owner", e.target.value)} options={userOptions} />
        <Input label="Due date" type="date" value={f.due} onChange={(e) => set("due", e.target.value)} />
        <Input label="Cost exposure (₹)" inputMode="numeric" value={f.cost} onChange={(e) => set("cost", e.target.value)} placeholder="180000" />
        <Input label="Schedule impact (days)" inputMode="numeric" value={f.days} onChange={(e) => set("days", e.target.value)} placeholder="2" />
      </div>
      <Textarea label="Description" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <SubmitBar label="Create Blocker" />
    </form>
  );
}

/* ---------- task ---------- */
export function TaskForm({ projectId, taskId, onDone }: { projectId?: string; taskId?: string; onDone?: () => void }) {
  const db = useDb();
  const projects = useProjectOptions();
  const t = db.tasks.find((x) => x.id === taskId);
  const [f, setF] = useState({
    name: t?.name ?? "", projectId: t?.projectId ?? projectId ?? projects[0].v, workstream: t?.workstream ?? "Engineering", owner: t?.owner ?? "u-rk",
    priority: t?.priority ?? ("Medium" as Priority), status: t?.status ?? ("Not Started" as TaskStatus), start: t?.start ?? TODAY, due: t?.due ?? TODAY,
    dependency: t?.dependency ?? "", estHours: String(t?.estHours ?? 8), notes: t?.notes ?? "",
  });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!f.name.trim()) return toast("Enter a task name.", "bad");
        const data = { name: f.name, projectId: f.projectId, workstream: f.workstream, owner: f.owner, priority: f.priority, status: f.status, start: f.start, due: f.due, dependency: f.dependency || undefined, estHours: +f.estHours || 0, notes: f.notes };
        if (t) { updateTask(t.id, data); toast(`${t.id} updated.`); } else { const id = createTask(data); toast(`${id} created.`); }
        onDone?.();
      }}
    >
      <Input label="Task name" value={f.name} onChange={(e) => set("name", e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Project" value={f.projectId} onChange={(e) => set("projectId", e.target.value)} options={projects} />
        <Select label="Workstream" value={f.workstream} onChange={(e) => set("workstream", e.target.value)} options={["Engineering", "Procurement", "Fabrication", "Finishing", "Quality", "Logistics", "Installation", "Planning"]} />
        <Select label="Owner" value={f.owner} onChange={(e) => set("owner", e.target.value)} options={userOptions} />
        <Select label="Priority" value={f.priority} onChange={(e) => set("priority", e.target.value)} options={PRIOS} />
        <Select label="Status" value={f.status} onChange={(e) => set("status", e.target.value)} options={TSTAT} />
        <Select label="Dependency" value={f.dependency} onChange={(e) => set("dependency", e.target.value)} options={[{ v: "", l: "None" }, ...db.tasks.filter((x) => x.id !== t?.id).map((x) => ({ v: x.id, l: `${x.id} — ${x.name.slice(0, 32)}` }))]} />
        <Input label="Start date" type="date" value={f.start} onChange={(e) => set("start", e.target.value)} />
        <Input label="Due date" type="date" value={f.due} onChange={(e) => set("due", e.target.value)} />
        <Input label="Estimated hours" inputMode="numeric" value={f.estHours} onChange={(e) => set("estHours", e.target.value)} />
      </div>
      <Textarea label="Notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      <SubmitBar label={t ? "Save Task" : "Create Task"} />
    </form>
  );
}

/* ---------- quick update ---------- */
import type { QuickKind } from "@/services/ui";
export const QUICK: { v: QuickKind; l: string; sub: string }[] = [
  { v: "progress", l: "Project progress", sub: "Move % complete" },
  { v: "task", l: "Task", sub: "Status or comment" },
  { v: "blocker", l: "Blocker", sub: "Raise a new issue" },
  { v: "vendor", l: "Vendor update", sub: "Revised forecast" },
  { v: "material", l: "Material receipt", sub: "Goods received, QC" },
  { v: "field", l: "Field update", sub: "Site status and photos" },
  { v: "shop", l: "Shop-floor update", sub: "Job progress" },
];

export function QuickForm({ kind, onDone }: { kind: QuickKind; onDone: () => void }) {
  const db = useDb();
  const projects = useProjectOptions();
  const [pid, setPid] = useState(projects[0].v);
  const proj = db.projects.find((p) => p.id === pid)!;
  const [pct, setPct] = useState(proj.progress);
  const [comment, setComment] = useState("");
  const openTasks = db.tasks.filter((t) => t.status !== "Completed");
  const [taskId, setTaskId] = useState(openTasks[0]?.id ?? "");
  const [tstat, setTstat] = useState<TaskStatus>("In Progress");
  const wps = db.workPackages.filter((w) => w.status !== "Delivered");
  const [wpId, setWpId] = useState(wps[0]?.id ?? "");
  const wp = db.workPackages.find((w) => w.id === wpId);
  const [fc, setFc] = useState(wp?.forecast ?? TODAY);
  const pos = db.purchaseOrders.filter((p) => !["Accepted"].includes(p.status));
  const [poId, setPoId] = useState(pos[0]?.id ?? "");
  const [res, setRes] = useState<"Accepted" | "Partially Received" | "Rejected">("Accepted");

  if (kind === "blocker") return <BlockerForm onDone={onDone} />;
  if (kind === "field") return <FieldUpdateForm onDone={onDone} />;
  if (kind === "shop") return <ShopUpdateForm onDone={onDone} />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (kind === "progress") {
      updateProject(pid, { progress: pct }, comment || undefined);
      toast(`${pid} progress set to ${pct}%.`);
    } else if (kind === "task") {
      updateTask(taskId, { status: tstat });
      if (comment) addComment(taskId, comment);
      toast(`${taskId} marked ${tstat}.`);
    } else if (kind === "vendor" && wp) {
      updateWorkPackage(wp.id, { forecast: fc, status: fc > wp.committed ? "Delayed" : wp.status }, comment);
      toast("Vendor forecast recorded. Notification sent.");
    } else if (kind === "material") {
      receiveMaterial(poId, res, comment);
      toast(res === "Rejected" ? "Material rejected — procurement notified." : "Material receipt recorded.");
    }
    onDone();
  };
  return (
    <form className="space-y-3" onSubmit={submit}>
      {kind === "progress" && (
        <>
          <Select label="Project" value={pid} onChange={(e) => { setPid(e.target.value); setPct(db.projects.find((p) => p.id === e.target.value)!.progress); }} options={projects} />
          <Field label={`Progress — ${pct}% (was ${proj.progress}%)`}>{(id) => <input id={id} type="range" min={0} max={100} value={pct} onChange={(e) => setPct(+e.target.value)} className="h-9 w-full accent-brand" />}</Field>
        </>
      )}
      {kind === "task" && (
        <>
          <Select label="Task" value={taskId} onChange={(e) => setTaskId(e.target.value)} options={openTasks.map((t) => ({ v: t.id, l: `${t.projectId} — ${t.name}` }))} />
          <Radios label="New status" value={tstat} onChange={(v) => setTstat(v as TaskStatus)} options={["In Progress", "Waiting", "Blocked", "Completed"]} />
        </>
      )}
      {kind === "vendor" && (
        <>
          <Select label="Work package" value={wpId} onChange={(e) => { setWpId(e.target.value); setFc(db.workPackages.find((w) => w.id === e.target.value)?.forecast ?? TODAY); }} options={wps.map((w) => ({ v: w.id, l: `${w.projectId} — ${w.title}` }))} />
          <Input label={`Delivery forecast (committed ${fmtDate(wp?.committed)})`} type="date" value={fc} onChange={(e) => setFc(e.target.value)} />
        </>
      )}
      {kind === "material" && (
        <>
          <Select label="Purchase order" value={poId} onChange={(e) => setPoId(e.target.value)} options={pos.map((p) => ({ v: p.id, l: `${p.id} — ${p.item} (${p.projectId})` }))} />
          <Radios label="Incoming QC result" value={res} onChange={(v) => setRes(v as typeof res)} options={["Accepted", "Partially Received", "Rejected"]} />
        </>
      )}
      <Textarea label="Comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional note for the activity feed" />
      <SubmitBar label="Submit Update" />
    </form>
  );
}

