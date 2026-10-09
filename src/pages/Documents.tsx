import { useState } from "react";
import { FileText, FileUp, SearchX } from "lucide-react";
import { createDocument, getUser, updateDocument, useDb } from "@/services/db";
import { toast } from "@/services/ui";
import type { DocumentRec } from "@/types";
import { fmtDate } from "@/utils";
import { ProjectLink } from "@/components/domain";
import { Badge, Btn, DataTable, Empty, FilterSelect, Input, Loader, Modal, PageHeader, Panel, Person, Select, StatusBadge, TableSkeleton, type Col } from "@/components/ui";

const TYPES = ["GA Drawing", "Fabrication Drawing", "P&ID", "BOM", "Purchase Order", "Inspection Report", "Welding Record", "Material Test Certificate", "FAT Report", "Installation Report", "Customer Approval"];

export default function Documents() {
  const db = useDb();
  const [type, setType] = useState("All");
  const [project, setProject] = useState("All");
  const [status, setStatus] = useState("All");
  const [up, setUp] = useState(false);
  const [f, setF] = useState({ filename: "", type: TYPES[0], projectId: db.projects[0].id, rev: "A" });
  const isLatest = (d: DocumentRec) => d.status !== "Superseded" && !db.documents.some((x) => x.series === d.series && x.projectId === d.projectId && x.rev > d.rev);
  const rows = db.documents.filter((d) => (type === "All" || d.type === type) && (project === "All" || d.projectId === project) && (status === "All" || d.status === status));
  const cols: Col<DocumentRec>[] = [
    { key: "f", header: "File", sort: (d) => d.filename, render: (d) => <span className="flex items-center gap-2 font-semibold"><FileText size={16} className="text-mute" />{d.filename}</span> },
    { key: "t", header: "Type", sort: (d) => d.type, render: (d) => d.type },
    { key: "p", header: "Project", sort: (d) => d.projectId, render: (d) => <ProjectLink id={d.projectId} /> },
    { key: "r", header: "Revision", sort: (d) => d.rev, render: (d) => <span className="inline-flex items-center gap-1.5"><span className="font-mono font-semibold">Rev {d.rev}</span>{isLatest(d) && <Badge tone="brand">Latest</Badge>}</span> },
    { key: "b", header: "Uploaded by", render: (d) => <Person id={d.by} /> },
    { key: "d", header: "Date", sort: (d) => d.date, render: (d) => fmtDate(d.date) },
    { key: "s", header: "Status", render: (d) => <StatusBadge s={d.status} /> },
    { key: "a", header: "", render: (d) => (d.status === "Under Review" || d.status === "Pending Customer" ? <Btn size="sm" onClick={(e) => { e.stopPropagation(); updateDocument(d.id, { status: "Approved" }); toast(`${d.filename} approved.`); }}>Approve</Btn> : null) },
  ];
  const clear = () => { setType("All"); setProject("All"); setStatus("All"); };
  return (
    <>
      <PageHeader title="Documents" sub="Drawings, certificates and reports — the latest revision is always highlighted." actions={<Btn variant="primary" onClick={() => setUp(true)}><FileUp size={16} /> Upload document</Btn>} />
      <Loader skeleton={<Panel><TableSkeleton rows={9} /></Panel>}>
        <Panel flush title={`${rows.length} documents`} action={<div className="flex flex-wrap gap-2"><FilterSelect label="Type" value={type} onChange={setType} options={["All", ...TYPES]} /><FilterSelect label="Project" value={project} onChange={setProject} options={["All", ...db.projects.map((p) => p.id)]} /><FilterSelect label="Status" value={status} onChange={setStatus} options={["All", "Approved", "Under Review", "Issued", "Pending Customer", "Superseded", "Rejected"]} /></div>}>
          <DataTable rows={rows} cols={cols} rowKey={(d) => d.id} rowClass={(d) => (isLatest(d) ? "bg-brand-soft/40" : d.status === "Superseded" ? "text-mute" : "")} initialSort={{ key: "d", dir: -1 }} empty={<Empty icon={<SearchX size={22} />} title="No documents found" text="No document fits these filters." action={<Btn onClick={clear}>Clear filters</Btn>} />} />
        </Panel>
      </Loader>
      <Modal open={up} onClose={() => setUp(false)} title="Upload document" footer={<><Btn onClick={() => setUp(false)}>Cancel</Btn><Btn variant="primary" type="submit" form="doc-form">Upload</Btn></>}>
        <form id="doc-form" className="space-y-3" onSubmit={(e) => { e.preventDefault(); createDocument({ filename: f.filename, type: f.type, projectId: f.projectId, rev: f.rev, series: f.filename.split("_")[0] || f.type, status: "Under Review" }); toast(`${f.filename} uploaded as Rev ${f.rev}.`); setUp(false); }}>
          <Input label="File name" required value={f.filename} onChange={(e) => setF({ ...f, filename: e.target.value })} placeholder="GA_FER-24026_RevD.pdf" />
          <Select label="Project" value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} options={db.projects.map((p) => p.id)} />
          <Select label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={TYPES} />
          <Input label="Revision" required value={f.rev} onChange={(e) => setF({ ...f, rev: e.target.value })} />
          <p className="text-[12px] text-mute">Uploaded by you · the previous revision is marked superseded automatically in production.</p>
        </form>
      </Modal>
    </>
  );
}
