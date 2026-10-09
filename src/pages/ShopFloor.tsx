import { useState } from "react";
import { Camera, CheckCircle2, Pause, Play, TriangleAlert } from "lucide-react";
import { getUser, updateShopJob, createShopUpdate, useDb, useSession } from "@/services/db";
import { toast } from "@/services/ui";
import type { ShopJob } from "@/types";
import { cx } from "@/utils";
import { ProjectLink } from "@/components/domain";
import { Btn, Empty, Loader, Modal, PageHeader, Panel, Progress, StatusBadge } from "@/components/ui";
import { ShopUpdateForm } from "@/components/forms";

function JobCard({ j, onIssue }: { j: ShopJob; onIssue: (id: string) => void }) {
  const db = useDb();
  const p = db.projects.find((x) => x.id === j.projectId);
  const [photo, setPhoto] = useState(false);
  const log = (status: string, progress = j.progress, comment = "") => createShopUpdate({ jobId: j.id, projectId: j.projectId, status, progress, comment: comment || `${status} from tablet.` });
  return (
    <article className={cx("rounded-xl border-2 bg-white p-4", j.status === "Blocked" ? "border-bad" : j.status === "Running" ? "border-brand" : "border-line")}>
      <div className="flex items-start justify-between gap-2">
        <div><p className="text-[12px] font-semibold uppercase tracking-wide text-mute"><ProjectLink id={j.projectId} /> · {p?.customer}</p><h3 className="text-[19px] font-semibold leading-6">{j.name}</h3></div>
        <StatusBadge s={j.status} />
      </div>
      <p className="mt-1 text-[14px] text-mute">{j.station} · {j.hours}h planned · {getUser(j.assignee)?.name}</p>
      <Progress value={j.progress} className="mt-3" />
      <div className="mt-2 flex flex-wrap gap-2 text-[13px]">
        <span className={cx("rounded px-1.5 py-0.5 font-semibold", j.materialOk ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad")}>{j.materialOk ? "Material available" : "Material missing"}</span>
        <span className="rounded bg-idle-soft px-1.5 py-0.5 text-mute">QC: {j.qc}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Btn size="lg" variant="primary" disabled={j.status === "Running" || j.status === "Completed" || !j.materialOk} onClick={() => { updateShopJob(j.id, { status: "Running" }); log("Started"); toast(`${j.name} started.`); }}><Play size={18} /> Start</Btn>
        <Btn size="lg" disabled={j.status !== "Running"} onClick={() => { updateShopJob(j.id, { status: "Paused" }); log("Paused"); toast(`${j.name} paused.`, "info"); }}><Pause size={18} /> Pause</Btn>
        <Btn size="lg" variant="success" disabled={j.status === "Completed"} onClick={() => { log("Completed", 100); toast(`${j.name} completed.`); }}><CheckCircle2 size={18} /> Complete</Btn>
        <Btn size="lg" variant="danger" onClick={() => onIssue(j.id)}><TriangleAlert size={18} /> Report Issue</Btn>
      </div>
      <label className="mt-2 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-[#b4bfd0] text-[14px] font-semibold text-mute hover:border-brand hover:text-brand">
        <Camera size={17} /> {photo ? "Photo attached" : "Upload Photo"}
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { if (e.target.files?.[0]) { setPhoto(true); toast("Photo attached to job."); } }} />
      </label>
    </article>
  );
}

export default function ShopFloor({ dashboard }: { dashboard?: boolean }) {
  const db = useDb();
  const session = useSession();
  const [issue, setIssue] = useState<string>();
  const [form, setForm] = useState(false);
  const name = getUser(session?.userId)?.name.split(" ")[0] ?? "";
  const body = (
    <>
      <PageHeader title={dashboard ? `Good morning, ${name}` : "Shop Floor"} sub="Today’s jobs. Tap a button to update — large targets for gloved hands." actions={<Btn variant="primary" size="lg" onClick={() => setForm(true)}>Quick Update</Btn>} />
      {db.shopJobs.length === 0 ? <Panel><Empty title="No jobs assigned" text="Jobs scheduled for your station will appear here." /></Panel> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{db.shopJobs.map((j) => <JobCard key={j.id} j={j} onIssue={setIssue} />)}</div>
      )}
      {db.shopUpdates.length > 0 && (
        <Panel title="Your recent updates" className="mt-4" flush>
          <ul className="divide-y divide-line">{db.shopUpdates.slice(0, 5).map((u) => <li key={u.id} className="px-4 py-2.5 text-[14px]"><b>{db.shopJobs.find((j) => j.id === u.jobId)?.name}</b> · {u.status} {u.progress}% — <span className="text-mute">{u.comment}</span></li>)}</ul>
        </Panel>
      )}
      <Modal open={form} onClose={() => setForm(false)} title="Quick update"><ShopUpdateForm onDone={() => setForm(false)} /></Modal>
      <Modal open={!!issue} onClose={() => setIssue(undefined)} title="Report issue"><ShopUpdateForm key={issue} jobId={issue} onDone={() => setIssue(undefined)} /></Modal>
    </>
  );
  return <Loader>{body}</Loader>;
}
