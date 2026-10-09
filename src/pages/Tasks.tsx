import { useState } from "react";
import { LayoutGrid, ListTodo, Plus, Search, SearchX, Flag } from "lucide-react";
import { getUser, updateTask, useDb } from "@/services/db";
import { toast, ui } from "@/services/ui";
import type { Task, TaskStatus } from "@/types";
import { cx, effectiveTaskStatus, fmtDate } from "@/utils";
import { ProjectLink, MilestoneList, useDateFilter } from "@/components/domain";
import { Avatar, Badge, Btn, DataTable, Empty, FilterSelect, Loader, PageHeader, Panel, Person, Seg, StatusBadge, TableSkeleton, type Col } from "@/components/ui";

const COLS: TaskStatus[] = ["Not Started", "In Progress", "Waiting", "Blocked", "Completed"];

function Card({ t, onDragStart }: { t: Task; onDragStart: (id: string) => void }) {
  const es = effectiveTaskStatus(t);
  return (
    <article draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", t.id); onDragStart(t.id); }} className={cx("cursor-grab rounded-md border bg-white p-2.5 shadow-sm active:cursor-grabbing", es === "Overdue" ? "border-bad/50" : "border-line")}>
      <button onClick={() => ui({ taskId: t.id })} className="block w-full text-left text-[14px] font-semibold leading-5 hover:text-brand">{t.name}</button>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5"><ProjectLink id={t.projectId} /><StatusBadge s={t.priority} dot={false} />{es === "Overdue" && <Badge tone="bad">Overdue</Badge>}</div>
      <div className="mt-2 flex items-center justify-between text-[12.5px] text-mute"><span className="flex items-center gap-1.5"><Avatar id={t.owner} size={18} />{getUser(t.owner)?.name.split(" ")[0]}</span><span>Due {fmtDate(t.due)}</span></div>
      <label className="sr-only" htmlFor={`mv-${t.id}`}>Move task</label>
      <select id={`mv-${t.id}`} value={t.status === "Overdue" ? "Not Started" : t.status} onChange={(e) => { updateTask(t.id, { status: e.target.value as TaskStatus }); toast(`Moved to ${e.target.value}.`); }} className="mt-2 h-7 w-full rounded border border-line bg-paper px-1 text-[12.5px] md:hidden">
        {COLS.map((c) => <option key={c}>{c}</option>)}
      </select>
    </article>
  );
}

export default function Tasks() {
  const db = useDb();
  const [view, setView] = useState<"table" | "kanban" | "milestones">("table");
  const [q, setQ] = useState("");
  const [project, setProject] = useState("All");
  const [owner, setOwner] = useState("All");
  const [status, setStatus] = useState("All");
  const [prio, setPrio] = useState("All");
  const date = useDateFilter();
  const [drag, setDrag] = useState<string>();
  const [over, setOver] = useState<string>();
  const rows = db.tasks.filter((t) => {
    const es = effectiveTaskStatus(t);
    return (!q || `${t.name} ${t.id}`.toLowerCase().includes(q.toLowerCase())) && (project === "All" || t.projectId === project) && (owner === "All" || t.owner === owner) && (status === "All" || es === status) && (prio === "All" || t.priority === prio) && date.test(t.due);
  });
  const cols: Col<Task>[] = [
    { key: "n", header: "Task", sort: (t) => t.name, render: (t) => <div><p className="font-semibold">{t.name}</p><p className="text-[12px] text-mute">{t.id} · {t.workstream}{t.dependency ? ` · depends on ${t.dependency}` : ""}</p></div> },
    { key: "p", header: "Project", sort: (t) => t.projectId, render: (t) => <ProjectLink id={t.projectId} /> },
    { key: "o", header: "Owner", sort: (t) => getUser(t.owner)?.name ?? "", render: (t) => <Person id={t.owner} /> },
    { key: "pr", header: "Priority", sort: (t) => t.priority, render: (t) => <StatusBadge s={t.priority} /> },
    { key: "s", header: "Status", sort: (t) => effectiveTaskStatus(t), render: (t) => <StatusBadge s={effectiveTaskStatus(t)} /> },
    { key: "d", header: "Due", sort: (t) => t.due, render: (t) => <span className="tnum whitespace-nowrap">{fmtDate(t.due)}</span> },
    { key: "a", header: "", render: (t) => (t.status !== "Completed" ? <Btn size="sm" onClick={(e) => { e.stopPropagation(); updateTask(t.id, { status: "Completed" }); toast(`${t.id} marked complete.`); }}>Complete</Btn> : <span className="text-[12px] text-ok">Done</span>) },
  ];
  const owners = [...new Set(db.tasks.map((t) => t.owner))];
  const clear = () => { setQ(""); setProject("All"); setOwner("All"); setStatus("All"); setPrio("All"); };
  return (
    <>
      <PageHeader title="Tasks & Milestones" sub={`${rows.length} of ${db.tasks.length} tasks shown.`} actions={<><Seg label="View" value={view} onChange={setView} options={[{ v: "table", l: <span className="flex items-center gap-1"><ListTodo size={14} /> Table</span> }, { v: "kanban", l: <span className="flex items-center gap-1"><LayoutGrid size={14} /> Kanban</span> }, { v: "milestones", l: <span className="flex items-center gap-1"><Flag size={14} /> Milestones</span> }]} /><Btn variant="primary" onClick={() => ui({ newTask: {} })}><Plus size={16} /> New task</Btn></>} />
      <Loader skeleton={<Panel><TableSkeleton rows={9} /></Panel>}>
        {view === "milestones" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {db.projects.map((p) => (
              <Panel key={p.id} title={p.id} sub={p.customer}><MilestoneList items={db.milestones.filter((m) => m.projectId === p.id)} /></Panel>
            ))}
          </div>
        ) : (
          <Panel
            flush
            title="Filters"
            action={
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative"><span className="sr-only">Search tasks</span><Search size={14} className="absolute left-2 top-2.5 text-mute" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" className="h-8 w-40 rounded-md border border-line pl-7 pr-2 text-[13px]" /></label>
                <FilterSelect label="Project" value={project} onChange={setProject} options={["All", ...db.projects.map((p) => p.id)]} />
                <FilterSelect label="Owner" value={owner} onChange={setOwner} options={[{ v: "All", l: "All" }, ...owners.map((o) => ({ v: o, l: getUser(o)?.name ?? o }))]} />
                <FilterSelect label="Status" value={status} onChange={setStatus} options={["All", "Not Started", "In Progress", "Waiting", "Blocked", "Overdue", "Completed"]} />
                <FilterSelect label="Priority" value={prio} onChange={setPrio} options={["All", "Critical", "High", "Medium", "Low"]} />
                {date.ui}
              </div>
            }
          >
            {view === "table" ? (
              <DataTable rows={rows} cols={cols} rowKey={(t) => t.id} onRow={(t) => ui({ taskId: t.id })} initialSort={{ key: "d", dir: 1 }} empty={<Empty icon={<SearchX size={22} />} title="No matching tasks" text="No task fits these filters." action={<Btn onClick={clear}>Clear filters</Btn>} />} />
            ) : (
              <div className="scroll-thin grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-3 overflow-x-auto bg-paper p-3">
                {COLS.map((c) => {
                  const list = rows.filter((t) => (c === "Not Started" ? t.status === "Not Started" || t.status === "Overdue" : t.status === c));
                  return (
                    <section
                      key={c}
                      aria-label={c}
                      onDragOver={(e) => { e.preventDefault(); setOver(c); }}
                      onDragLeave={() => setOver(undefined)}
                      onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || drag; setOver(undefined); if (id && db.tasks.find((t) => t.id === id)?.status !== c) { updateTask(id, { status: c }); toast(`${id} moved to ${c}.`); } }}
                      className={cx("min-h-[200px] rounded-lg border p-2", over === c ? "border-brand bg-brand-soft" : "border-line bg-[#eef1f6]")}
                    >
                      <h3 className="mb-2 flex items-center justify-between px-1 text-[12px] font-bold uppercase tracking-wider text-mute">{c}<span className="rounded bg-white px-1.5">{list.length}</span></h3>
                      <div className="space-y-2">{list.map((t) => <Card key={t.id} t={t} onDragStart={setDrag} />)}</div>
                    </section>
                  );
                })}
              </div>
            )}
          </Panel>
        )}
      </Loader>
    </>
  );
}
