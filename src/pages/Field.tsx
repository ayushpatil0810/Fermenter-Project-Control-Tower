import { useState } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import { getUser, toggleSiteTask, useDb, useSession } from "@/services/db";
import { fmtDateY } from "@/utils";
import { ProjectLink } from "@/components/domain";
import { Btn, Empty, Loader, Modal, PageHeader, Panel, Progress, StatusBadge } from "@/components/ui";
import { FieldUpdateForm } from "@/components/forms";
import { ui } from "@/services/ui";

export default function Field({ dashboard }: { dashboard?: boolean }) {
  const db = useDb();
  const session = useSession();
  const [form, setForm] = useState<string | null>(null);
  const name = getUser(session?.userId)?.name.split(" ")[0] ?? "";
  return (
    <Loader>
      <PageHeader title={dashboard ? `Good morning, ${name}` : "Field / Installation"} sub="Site jobs, checklists and on-site updates." actions={<Btn variant="primary" size="lg" onClick={() => setForm("")}>Field update</Btn>} />
      {db.siteJobs.length === 0 ? <Panel><Empty title="No site jobs" text="Scheduled installations will appear here." /></Panel> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {db.siteJobs.map((j) => {
            const done = j.tasks.filter((t) => t.done).length;
            const pct = Math.round((done / j.tasks.length) * 100);
            const p = db.projects.find((x) => x.id === j.projectId);
            return (
              <Panel key={j.id} title={j.customer} sub={<span className="flex flex-wrap items-center gap-x-3"><ProjectLink id={j.projectId} /><span className="inline-flex items-center gap-1"><MapPin size={12} />{j.location}</span><span className="inline-flex items-center gap-1"><CalendarDays size={12} />{fmtDateY(j.date.slice(0, 10))}</span></span>} action={p && <StatusBadge s={p.health} />}>
                <Progress value={pct} className="mb-3" />
                <ul className="space-y-1.5">
                  {j.tasks.map((t) => (
                    <li key={t.name}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-line px-3 text-[15px] hover:bg-paper">
                        <input type="checkbox" checked={t.done} onChange={() => toggleSiteTask(j.id, t.name)} className="size-5 accent-brand" />
                        <span className={t.done ? "text-mute line-through" : "font-medium"}>{t.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Btn size="lg" variant="primary" onClick={() => setForm(j.projectId)}>Update site status</Btn>
                  <Btn size="lg" variant="danger" onClick={() => ui({ newBlocker: { projectId: j.projectId } })}>Raise blocker</Btn>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
      {db.fieldUpdates.length > 0 && (
        <Panel title="Recent field updates" className="mt-4" flush>
          <ul className="divide-y divide-line">{db.fieldUpdates.slice(0, 5).map((u) => <li key={u.id} className="px-4 py-2.5 text-[14px]"><b>{u.projectId}</b> · {u.status} — <span className="text-mute">{u.comment}</span>{u.blockerId && <> · <span className="font-semibold text-bad">{u.blockerId} raised</span></>}</li>)}</ul>
        </Panel>
      )}
      <Modal open={form !== null} onClose={() => setForm(null)} title="Field update"><FieldUpdateForm key={form ?? ""} projectId={form || undefined} onDone={() => setForm(null)} /></Modal>
    </Loader>
  );
}
