import { useState } from "react";
import { SearchX } from "lucide-react";
import { getUser, useDb } from "@/services/db";
import { ActivityItem, groupByDay } from "@/components/domain";
import { Btn, Empty, FilterSelect, Loader, PageHeader, Panel, TableSkeleton } from "@/components/ui";

const KINDS = ["All", "update", "blocker", "vendor", "material", "design", "field", "quality", "milestone", "task"];

export default function ActivityFeed() {
  const db = useDb();
  const [project, setProject] = useState("All");
  const [kind, setKind] = useState("All");
  const [user, setUser] = useState("All");
  const rows = [...db.activities].sort((a, b) => b.ts.localeCompare(a.ts)).filter((a) => (project === "All" || a.projectId === project) && (kind === "All" || a.kind === kind) && (user === "All" || a.userId === user));
  const users = [...new Set(db.activities.map((a) => a.userId))];
  return (
    <>
      <PageHeader title="Activity feed" sub="A timestamped record of every update, decision and delivery." />
      <Loader skeleton={<Panel><TableSkeleton rows={9} /></Panel>}>
        <Panel title={`${rows.length} events`} action={<div className="flex flex-wrap gap-2"><FilterSelect label="Project" value={project} onChange={setProject} options={["All", ...db.projects.map((p) => p.id)]} /><FilterSelect label="Type" value={kind} onChange={setKind} options={KINDS} /><FilterSelect label="User" value={user} onChange={setUser} options={[{ v: "All", l: "All" }, ...users.map((u) => ({ v: u, l: getUser(u)?.name ?? u }))]} /></div>}>
          {rows.length === 0 ? <Empty icon={<SearchX size={22} />} title="No activity found" text="No events match these filters." action={<Btn onClick={() => { setProject("All"); setKind("All"); setUser("All"); }}>Clear filters</Btn>} /> : groupByDay(rows).map(([day, items]) => (
            <section key={day} className="mb-2">
              <h2 className="sticky top-0 z-10 -mx-1 bg-white/95 px-1 py-1.5 font-display text-[14px] font-semibold uppercase tracking-widest text-mute">{day}</h2>
              <ul className="divide-y divide-line">{items.map((a) => <ActivityItem key={a.id} a={a} />)}</ul>
            </section>
          ))}
        </Panel>
      </Loader>
    </>
  );
}
