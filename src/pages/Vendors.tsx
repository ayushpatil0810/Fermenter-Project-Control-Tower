import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { ArrowLeft, Mail, MapPin, Phone, Repeat } from "lucide-react";
import { getVendorPerformance, updateWorkPackage, useDb } from "@/services/db";
import { navigate, toast, ui } from "@/services/ui";
import type { Vendor } from "@/types";
import { diffDays, fmtDate, fmtDateY } from "@/utils";
import { ProjectLink } from "@/components/domain";
import { Badge, Btn, DataTable, Empty, Input, Kpi, Loader, Modal, PageHeader, Panel, StatusBadge, TableSkeleton, PageSkeleton, Textarea, type Col } from "@/components/ui";

export function Vendors() {
  const db = useDb();
  const cols: Col<Vendor>[] = [
    { key: "n", header: "Vendor", sort: (v) => v.name, render: (v) => <div><p className="font-semibold text-brand">{v.name}</p><p className="text-[12px] text-mute">{v.services}</p></div> },
    { key: "l", header: "Location", sort: (v) => v.location, render: (v) => v.location },
    { key: "j", header: "Active jobs", sort: (v) => v.activeJobs, align: "right", render: (v) => <span className="tnum">{v.activeJobs}</span> },
    { key: "o", header: "On-time", sort: (v) => v.onTime, align: "right", render: (v) => <span className="tnum font-semibold">{v.onTime}%</span> },
    { key: "d", header: "Avg delay", sort: (v) => v.avgDelay, align: "right", render: (v) => <span className="tnum">{v.avgDelay}d</span> },
    { key: "b", header: "Open blockers", sort: (v) => db.blockers.filter((b) => b.vendorId === v.id && b.status !== "Resolved").length, align: "right", render: (v) => db.blockers.filter((b) => b.vendorId === v.id && b.status !== "Resolved").length || "—" },
    { key: "h", header: "Health", sort: (v) => v.health, render: (v) => <StatusBadge s={v.health} /> },
  ];
  return (
    <>
      <PageHeader title="Vendors" sub={`${db.vendors.length} fabrication, machining and supply partners.`} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Vendors" value={db.vendors.length} />
        <Kpi label="At risk" value={db.vendors.filter((v) => v.health === "At Risk").length} tone="warn" />
        <Kpi label="Avg on-time" value={`${Math.round(db.vendors.reduce((s, v) => s + v.onTime, 0) / db.vendors.length)}%`} tone="brand" />
        <Kpi label="Delayed packages" value={db.workPackages.filter((w) => w.status === "Delayed").length} tone="bad" />
      </div>
      <Loader skeleton={<Panel><TableSkeleton rows={8} /></Panel>}>
        <Panel flush><DataTable rows={db.vendors} cols={cols} rowKey={(v) => v.id} onRow={(v) => navigate(`vendor/${v.id}`)} /></Panel>
      </Loader>
    </>
  );
}

function ForecastModal({ wp, onClose }: { wp?: ReturnType<typeof useDb>["workPackages"][number]; onClose: () => void }) {
  const [date, setDate] = useState(wp?.forecast ?? "");
  const [note, setNote] = useState("");
  if (!wp) return null;
  return (
    <Modal open onClose={onClose} title="Update forecast" footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={() => { updateWorkPackage(wp.id, { forecast: date, status: date > wp.committed ? "Delayed" : "In Progress" }, note); toast("Forecast updated. Linked blocker, dashboard and activity feed refreshed."); onClose(); }}>Save forecast</Btn></>}>
      <div className="space-y-3">
        <p className="text-[14px]"><b>{wp.title}</b> · committed {fmtDateY(wp.committed)}</p>
        <Input label="Revised delivery date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Textarea label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Vendor confirmed over phone with Mr. Patil." rows={2} />
      </div>
    </Modal>
  );
}

export function VendorDetail({ id }: { id: string }) {
  const db = useDb();
  const [edit, setEdit] = useState<string>();
  const perf = getVendorPerformance(id);
  const v = db.vendors.find((x) => x.id === id);
  if (!v) return <Empty title="Vendor not found" text="This vendor does not exist." action={<Btn variant="primary" onClick={() => navigate("vendors")}>Back to vendors</Btn>} />;
  const alt = db.vendors.filter((x) => x.isAlternative && x.id !== v.id);
  const wps = db.workPackages.filter((w) => w.vendorId === id);
  const blks = db.blockers.filter((b) => b.vendorId === id && b.status !== "Resolved");
  const months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
  const hist = v.history.map((n, i) => ({ m: months[months.length - v.history.length + i] ?? `M${i + 1}`, onTime: n }));
  const delays = wps.map((w) => ({ name: w.id, delay: Math.max(0, diffDays(w.committed, w.forecast)) }));
  const editWp = wps.find((w) => w.id === edit);
  return (
    <>
      <PageHeader
        crumb={<button onClick={() => navigate("vendors")} className="mb-1 flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline"><ArrowLeft size={14} /> All vendors</button>}
        title={<span className="flex flex-wrap items-center gap-3">{v.name}<StatusBadge s={v.health} /></span>}
        sub={v.services}
        actions={<Btn onClick={() => ui({ quick: "vendor" })}>Log vendor update</Btn>}
      />
      <Loader skeleton={<PageSkeleton />}>
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="On-time delivery" value={`${perf.onTime}%`} tone={perf.onTime >= 90 ? "ok" : "warn"} />
          <Kpi label="Late deliveries" value={perf.lateDeliveries} tone="bad" sub="last 12 months" />
          <Kpi label="Average delay" value={`${perf.avgDelay}d`} tone="warn" />
          <Kpi label="Active jobs" value={perf.activeJobs} tone="brand" sub={`${perf.openBlockers} open blockers`} />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Panel title="Work packages" flush>
              {wps.length === 0 ? <Empty title="No work packages" text="This vendor has no assigned packages." /> : (
                <ul className="divide-y divide-line">{wps.map((w) => {
                  const late = diffDays(w.committed, w.forecast);
                  return (
                    <li key={w.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1"><p className="font-semibold">{w.title}</p><p className="text-[12.5px] text-mute"><ProjectLink id={w.projectId} /> · committed {fmtDate(w.committed)} · forecast {fmtDate(w.forecast)}{late > 0 && <span className="font-semibold text-bad"> (+{late}d)</span>}</p></div>
                      <StatusBadge s={w.status} />
                      {w.status !== "Delivered" && <Btn size="sm" onClick={() => setEdit(w.id)}>Update forecast</Btn>}
                    </li>
                  );
                })}</ul>
              )}
            </Panel>
            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="On-time delivery trend" sub="% of packages on time, monthly">
                <div className="h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={hist} margin={{ left: -20, right: 8, top: 8 }}><CartesianGrid stroke="#e3e8f0" vertical={false} /><XAxis dataKey="m" tick={{ fontSize: 12 }} /><YAxis domain={[40, 100]} tick={{ fontSize: 12 }} /><Tooltip /><ReferenceLine y={90} stroke="#0f7d45" strokeDasharray="4 3" label={{ value: "Target 90%", fontSize: 11, fill: "#0f7d45", position: "insideBottomRight" }} /><Area type="monotone" dataKey="onTime" name="On-time %" stroke="#1b5bd0" fill="#dbe7fb" strokeWidth={2} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>
              </Panel>
              <Panel title="Forecast slippage by package" sub="Days beyond committed date">
                <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={delays} margin={{ left: -20, right: 8, top: 8 }}><CartesianGrid stroke="#e3e8f0" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="delay" name="Days late" fill="#c02525" radius={[3, 3, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div>
              </Panel>
            </div>
            {blks.length > 0 && (
              <Panel title="Open blockers linked to this vendor" flush>
                <ul className="divide-y divide-line">{blks.map((b) => <li key={b.id}><button onClick={() => ui({ blockerId: b.id })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper"><StatusBadge s={b.severity} /><span className="flex-1 font-semibold">{b.title}</span><ProjectLink id={b.projectId} /></button></li>)}</ul>
              </Panel>
            )}
          </div>
          <div className="space-y-4">
            <Panel title="Contact">
              <ul className="space-y-2 text-[14px]">
                <li className="font-semibold">{v.contact}</li>
                <li className="flex items-center gap-2 text-mute"><MapPin size={14} />{v.location}</li>
                <li className="flex items-center gap-2"><Phone size={14} className="text-mute" /><a className="text-brand hover:underline" href={`tel:${v.phone.replace(/\s/g, "")}`}>{v.phone}</a></li>
                <li className="flex items-center gap-2"><Mail size={14} className="text-mute" /><a className="text-brand hover:underline" href={`mailto:${v.email}`}>{v.email}</a></li>
              </ul>
            </Panel>
            {!v.isAlternative && (
              <Panel title="Alternate vendor" sub="Qualified backup for this scope">
                {alt.length === 0 ? <p className="text-[14px] text-mute">No alternate vendor registered.</p> : alt.map((a) => (
                  <div key={a.id} className="space-y-2">
                    <div className="flex items-center gap-2"><Repeat size={16} className="text-brand" /><p className="font-semibold">{a.name}</p><Badge tone="ok">{a.onTime}% on-time</Badge></div>
                    <p className="text-[13px] text-mute">{a.services} · {a.location}</p>
                    <div className="flex gap-2"><Btn size="sm" onClick={() => navigate(`vendor/${a.id}`)}>View profile</Btn><Btn size="sm" variant="primary" onClick={() => toast(`Quote request sent to ${a.name}.`)}>Request quote</Btn></div>
                  </div>
                ))}
              </Panel>
            )}
            {v.isAlternative && <Panel title="Role"><p className="text-[14px]">Registered alternate vendor for machining and shaft work.</p></Panel>}
          </div>
        </div>
      </Loader>
      {editWp && <ForecastModal key={editWp.id} wp={editWp} onClose={() => setEdit(undefined)} />}
    </>
  );
}
