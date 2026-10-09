import { useState } from "react";
import { PackageCheck, SearchX } from "lucide-react";
import { receiveMaterial, updatePO, useDb } from "@/services/db";
import { toast } from "@/services/ui";
import { PO_STATUSES, type POStatus, type PurchaseOrder } from "@/types";
import { fmtDate, inr, poDelay } from "@/utils";
import { ProjectLink } from "@/components/domain";
import { Badge, Btn, DataTable, Empty, FilterSelect, Kpi, Loader, Modal, Mono, PageHeader, Panel, Select, TableSkeleton, Textarea, type Col } from "@/components/ui";
import { StatusBadge } from "@/components/ui";

function Receipt({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  const [res, setRes] = useState<"Accepted" | "Partially Received" | "Rejected">("Accepted");
  const [note, setNote] = useState("");
  return (
    <Modal open onClose={onClose} title="Material receipt" footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={() => { receiveMaterial(po.id, res, note); toast(`${po.item}: ${res}. Activity feed updated.`); onClose(); }}>Record receipt</Btn></>}>
      <div className="space-y-3">
        <p className="text-[14px]"><b>{po.item}</b> · {po.po} · {po.qty}</p>
        <Select label="QC result" value={res} onChange={(e) => setRes(e.target.value as typeof res)} options={["Accepted", "Partially Received", "Rejected"]} />
        <Textarea label="Inspection note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="MTC verified, thickness 6.0 mm, no surface defects." rows={2} />
      </div>
    </Modal>
  );
}

export default function Procurement() {
  const db = useDb();
  const [project, setProject] = useState("All");
  const [vendor, setVendor] = useState("All");
  const [status, setStatus] = useState("All");
  const [rec, setRec] = useState<PurchaseOrder>();
  const rows = db.purchaseOrders.filter((o) => (project === "All" || o.projectId === project) && (vendor === "All" || o.vendorId === vendor) && (status === "All" || (status === "Delayed" ? poDelay(o) > 0 && !o.actual : o.status === status)));
  const delayed = db.purchaseOrders.filter((o) => poDelay(o) > 0 && !o.actual);
  const cols: Col<PurchaseOrder>[] = [
    { key: "i", header: "Material / item", sort: (o) => o.item, render: (o) => <span className="font-semibold">{o.item}</span> },
    { key: "p", header: "Project", sort: (o) => o.projectId, render: (o) => <ProjectLink id={o.projectId} /> },
    { key: "v", header: "Vendor", sort: (o) => o.vendorId, render: (o) => db.vendors.find((v) => v.id === o.vendorId)?.name },
    { key: "po", header: "PO", render: (o) => <Mono>{o.po}</Mono> },
    { key: "q", header: "Qty", render: (o) => o.qty },
    { key: "r", header: "Required", sort: (o) => o.required, render: (o) => <span className="whitespace-nowrap">{fmtDate(o.required)}</span> },
    { key: "e", header: "Expected", sort: (o) => o.expected, render: (o) => <span className="whitespace-nowrap">{fmtDate(o.expected)}</span> },
    { key: "a", header: "Actual", render: (o) => (o.actual ? fmtDate(o.actual) : "—") },
    { key: "d", header: "Delay", sort: (o) => poDelay(o), align: "right", render: (o) => (poDelay(o) > 0 ? <Badge tone="bad">+{poDelay(o)}d</Badge> : <span className="text-mute">—</span>) },
    { key: "s", header: "Status", render: (o) => (
      <select aria-label={`Status for ${o.item}`} value={o.status} onClick={(e) => e.stopPropagation()} onChange={(e) => { updatePO(o.id, { status: e.target.value as POStatus }); toast(`${o.po} set to ${e.target.value}.`); }} className="h-8 rounded-md border border-line bg-white px-1.5 text-[13px] font-medium">
        {PO_STATUSES.map((s) => <option key={s}>{s}</option>)}
      </select>
    ) },
    { key: "c", header: "Cost", sort: (o) => o.cost, align: "right", render: (o) => <span className="tnum whitespace-nowrap">{inr(o.cost)}</span> },
    { key: "x", header: "", render: (o) => (!["Received", "Accepted"].includes(o.status) ? <Btn size="sm" onClick={() => setRec(o)}><PackageCheck size={14} /> Receive</Btn> : <StatusBadge s={o.status} />) },
  ];
  const clear = () => { setProject("All"); setVendor("All"); setStatus("All"); };
  return (
    <>
      <PageHeader title="Procurement" sub="Purchase orders, delivery dates and material receipts across all projects." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Open POs" value={db.purchaseOrders.filter((o) => !["Received", "Accepted"].includes(o.status)).length} tone="brand" />
        <Kpi label="Delayed" value={delayed.length} tone="bad" />
        <Kpi label="Received / accepted" value={db.purchaseOrders.filter((o) => ["Received", "Accepted"].includes(o.status)).length} tone="ok" />
        <Kpi label="Open PO value" value={inr(db.purchaseOrders.filter((o) => !["Received", "Accepted"].includes(o.status)).reduce((s, o) => s + o.cost, 0))} />
      </div>
      <Loader skeleton={<Panel><TableSkeleton rows={8} /></Panel>}>
        <Panel flush title={`${rows.length} purchase orders`} action={<div className="flex flex-wrap gap-2"><FilterSelect label="Project" value={project} onChange={setProject} options={["All", ...db.projects.map((p) => p.id)]} /><FilterSelect label="Vendor" value={vendor} onChange={setVendor} options={[{ v: "All", l: "All" }, ...db.vendors.map((v) => ({ v: v.id, l: v.name }))]} /><FilterSelect label="Status" value={status} onChange={setStatus} options={["All", ...PO_STATUSES]} /></div>}>
          <DataTable rows={rows} cols={cols} rowKey={(o) => o.id} dense rowClass={(o) => (poDelay(o) > 0 && !o.actual ? "bg-bad-soft/50" : "")} initialSort={{ key: "r", dir: 1 }} empty={<Empty icon={<SearchX size={22} />} title="No matching purchase orders" text="No PO fits these filters." action={<Btn onClick={clear}>Clear filters</Btn>} />} />
        </Panel>
      </Loader>
      {rec && <Receipt po={rec} onClose={() => setRec(undefined)} />}
    </>
  );
}
