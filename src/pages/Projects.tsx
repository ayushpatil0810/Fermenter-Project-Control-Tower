import { useState } from "react";
import { Plus, Search, SearchX } from "lucide-react";
import { createProject, getUser, useDb } from "@/services/db";
import { navigate, toast } from "@/services/ui";
import { STAGES, type Project, type StageName } from "@/types";
import { TODAY, addDays } from "@/utils";
import { ProjectTable, useDateFilter } from "@/components/domain";
import { Btn, Empty, FilterSelect, Input, Loader, Modal, PageHeader, Panel, Select, TableSkeleton } from "@/components/ui";
import { users } from "@/data/seed";

function NewProject({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState({ customer: "", equipment: "Fermenter", type: "Fermenter", capacity: "1000", pm: "u-rk", delivery: addDays(TODAY, 120), value: "2500000", siteCity: "" });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = 40 + Math.floor(Math.random() * 50);
    const p: Project = {
      id: `FER-${new Date().getFullYear() - 2000}0${n}`.slice(0, 9),
      customer: f.customer,
      equipment: `${Number(f.capacity).toLocaleString("en-IN")}L ${f.equipment}`,
      type: f.type as Project["type"],
      capacity: Number(f.capacity),
      material: "SS316L",
      automation: "PLC + HMI",
      pm: f.pm,
      stage: "Customer Requirement" as StageName,
      stagePct: 10,
      progress: 5,
      health: "On Track",
      healthReason: "Newly created project. No blockers recorded.",
      value: Number(f.value),
      start: TODAY,
      delivery: f.delivery,
      siteCity: f.siteCity || "To be confirmed",
    };
    createProject(p);
    toast(`Project ${p.id} created.`);
    onClose();
    navigate(`project/${p.id}`);
  };
  return (
    <Modal open={open} onClose={onClose} title="New project" footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" type="submit" form="np-form">Create project</Btn></>}>
      <form id="np-form" onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Input className="sm:col-span-2" label="Customer" required value={f.customer} onChange={(e) => set("customer", e.target.value)} placeholder="e.g. Deccan Biologics Pvt. Ltd." />
        <Select label="Type" value={f.type} onChange={(e) => set("type", e.target.value)} options={["Fermenter", "Bioreactor"]} />
        <Input label="Capacity (litres)" type="number" min={50} required value={f.capacity} onChange={(e) => set("capacity", e.target.value)} />
        <Select label="Project manager" value={f.pm} onChange={(e) => set("pm", e.target.value)} options={users.filter((u) => u.role === "Project Manager" || u.role === "Owner").map((u) => ({ v: u.id, l: u.name }))} />
        <Input label="Site city" value={f.siteCity} onChange={(e) => set("siteCity", e.target.value)} />
        <Input label="Delivery date" type="date" required value={f.delivery} onChange={(e) => set("delivery", e.target.value)} />
        <Input label="Contract value (₹)" type="number" min={0} required value={f.value} onChange={(e) => set("value", e.target.value)} />
      </form>
    </Modal>
  );
}

export default function Projects() {
  const db = useDb();
  const [q, setQ] = useState("");
  const [health, setHealth] = useState("All");
  const [stage, setStage] = useState("All");
  const [pm, setPm] = useState("All");
  const [neu, setNeu] = useState(false);
  const date = useDateFilter();
  const pms = [...new Set(db.projects.map((p) => p.pm))];
  const rows = db.projects.filter((p) => {
    const hay = `${p.id} ${p.customer} ${p.equipment} ${p.siteCity}`.toLowerCase();
    return (!q || hay.includes(q.toLowerCase())) && (health === "All" || p.health === health) && (stage === "All" || p.stage === stage) && (pm === "All" || p.pm === pm) && date.test(p.delivery);
  });
  const clear = () => { setQ(""); setHealth("All"); setStage("All"); setPm("All"); };
  return (
    <>
      <PageHeader title="Projects" sub={`${db.projects.length} fermenter and bioreactor projects in the portfolio.`} actions={<Btn variant="primary" onClick={() => setNeu(true)}><Plus size={16} /> New project</Btn>} />
      <Loader skeleton={<Panel><TableSkeleton rows={8} /></Panel>}>
        <Panel
          flush
          action={
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative">
                <span className="sr-only">Search projects</span>
                <Search size={14} className="absolute left-2 top-2.5 text-mute" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID, customer…" className="h-8 w-48 rounded-md border border-line pl-7 pr-2 text-[13px]" />
              </label>
              <FilterSelect label="Status" value={health} onChange={setHealth} options={["All", "On Track", "At Risk", "Blocked"]} />
              <FilterSelect label="Stage" value={stage} onChange={setStage} options={["All", ...STAGES]} />
              <FilterSelect label="PM" value={pm} onChange={setPm} options={[{ v: "All", l: "All" }, ...pms.map((id) => ({ v: id, l: getUser(id)?.name ?? id }))]} />
              {date.ui}
            </div>
          }
          title={`${rows.length} project${rows.length === 1 ? "" : "s"}`}
        >
          <ProjectTable rows={rows} empty={<Empty icon={<SearchX size={22} />} title="No matching projects" text="No project fits these filters. Clear them to see the whole portfolio." action={<Btn onClick={clear}>Clear filters</Btn>} />} />
        </Panel>
      </Loader>
      <NewProject open={neu} onClose={() => setNeu(false)} />
    </>
  );
}
