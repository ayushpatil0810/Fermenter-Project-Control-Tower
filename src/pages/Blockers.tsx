import { useState } from "react";
import { CheckCircle2, Plus, Search, SearchX } from "lucide-react";
import { getUser, useDb } from "@/services/db";
import { ui, openCopilot } from "@/services/ui";
import type { Blocker } from "@/types";
import { blockerAge, fmtDate, inr, sevRank } from "@/utils";
import { ProjectLink } from "@/components/domain";
import { Btn, DataTable, Empty, FilterSelect, Kpi, Loader, Mono, PageHeader, Panel, Person, StatusBadge, TableSkeleton, type Col } from "@/components/ui";

export default function Blockers() {
  const db = useDb();
  const [q, setQ] = useState("");
  const [sev, setSev] = useState("All");
  const [status, setStatus] = useState("Active");
  const [project, setProject] = useState("All");
  const [cat, setCat] = useState("All");
  const rows = db.blockers.filter((b) => (!q || `${b.id} ${b.title}`.toLowerCase().includes(q.toLowerCase())) && (sev === "All" || b.severity === sev) && (status === "All" || (status === "Active" ? b.status !== "Resolved" : b.status === status)) && (project === "All" || b.projectId === project) && (cat === "All" || b.category === cat));
  const open = db.blockers.filter((b) => b.status !== "Resolved");
  const cols: Col<Blocker>[] = [
    { key: "id", header: "ID", sort: (b) => b.id, render: (b) => <Mono className="text-brand">{b.id}</Mono> },
    { key: "t", header: "Blocker", sort: (b) => b.title, className: "min-w-[240px]", render: (b) => <div><p className="font-semibold">{b.title}</p><p className="text-[12px] text-mute">{b.category}{b.vendorId ? ` · ${db.vendors.find((v) => v.id === b.vendorId)?.name}` : ""}</p></div> },
    { key: "p", header: "Project", sort: (b) => b.projectId, render: (b) => <ProjectLink id={b.projectId} /> },
    { key: "s", header: "Severity", sort: (b) => sevRank[b.severity], render: (b) => <StatusBadge s={b.severity} /> },
    { key: "st", header: "Status", sort: (b) => b.status, render: (b) => <StatusBadge s={b.status} /> },
    { key: "o", header: "Owner", sort: (b) => getUser(b.owner)?.name ?? "", render: (b) => <Person id={b.owner} /> },
    { key: "a", header: "Age", sort: (b) => blockerAge(b), align: "right", render: (b) => <span className="tnum">{blockerAge(b)}d</span> },
    { key: "d", header: "Due", sort: (b) => b.due, render: (b) => <span className="whitespace-nowrap">{fmtDate(b.due)}</span> },
    { key: "c", header: "Cost impact", sort: (b) => b.costImpact, align: "right", render: (b) => (b.costImpact ? <span className="tnum">{inr(b.costImpact)}</span> : "—") },
  ];
  const clear = () => { setQ(""); setSev("All"); setStatus("All"); setProject("All"); setCat("All"); };
  return (
    <>
      <PageHeader title="Blockers" sub="Every issue holding up a project — owned, dated and tracked to resolution." actions={<><Btn onClick={()=>openCopilot(project==="All" ? undefined : project, "Show open blockers")}>Ask Copilot</Btn><Btn variant="primary" onClick={() => ui({ newBlocker: {} })}><Plus size={16} /> Raise blocker</Btn></>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Open" value={open.length} tone="bad" />
        <Kpi label="Critical" value={open.filter((b) => b.severity === "Critical").length} tone="bad" />
        <Kpi label="Escalated" value={open.filter((b) => b.status === "Escalated").length} tone="warn" />
        <Kpi label="Resolved" value={db.blockers.length - open.length} tone="ok" />
      </div>
      <Loader skeleton={<Panel><TableSkeleton rows={7} /></Panel>}>
        <Panel
          flush
          title={`${rows.length} blocker${rows.length === 1 ? "" : "s"}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative"><span className="sr-only">Search blockers</span><Search size={14} className="absolute left-2 top-2.5 text-mute" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-8 w-36 rounded-md border border-line pl-7 pr-2 text-[13px]" /></label>
              <FilterSelect label="Severity" value={sev} onChange={setSev} options={["All", "Critical", "High", "Medium", "Low"]} />
              <FilterSelect label="Status" value={status} onChange={setStatus} options={["Active", "All", "Open", "Investigating", "Waiting", "Escalated", "Resolved"]} />
              <FilterSelect label="Project" value={project} onChange={setProject} options={["All", ...db.projects.map((p) => p.id)]} />
              <FilterSelect label="Category" value={cat} onChange={setCat} options={["All", "Engineering", "Procurement", "Vendor", "Material", "Fabrication", "Quality", "Customer", "Installation", "Logistics", "Documentation"]} />
            </div>
          }
        >
          <DataTable rows={rows} cols={cols} rowKey={(b) => b.id} onRow={(b) => ui({ blockerId: b.id })} initialSort={{ key: "s", dir: 1 }}
            empty={status === "Active" && sev === "All" && project === "All" && cat === "All" && !q
              ? <Empty icon={<CheckCircle2 size={22} />} title="No open blockers" text="All critical issues are currently resolved." />
              : <Empty icon={<SearchX size={22} />} title="No matching blockers" text="No blocker fits these filters." action={<Btn onClick={clear}>Clear filters</Btn>} />} />
        </Panel>
      </Loader>
    </>
  );
}
