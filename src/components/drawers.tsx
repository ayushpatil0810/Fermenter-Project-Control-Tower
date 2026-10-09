import { useState } from "react";
import { ArrowUpRight, CheckCircle2, FileText, Paperclip, Send, ShieldAlert } from "lucide-react";
import { addComment, escalateBlocker, getUser, resolveBlocker, toggleBlockerAction, updateBlocker, updateTask, useDb } from "@/services/db";
import { navigate, toast, ui, useUI } from "@/services/ui";
import type { BlockerStatus, Priority, TaskStatus } from "@/types";
import { blockerAge, effectiveTaskStatus, fmtDate, fmtTs, inr } from "@/utils";
import { userOptions, TaskForm } from "./forms";
import { Avatar, Badge, Btn, Drawer, Input, Select, StatusBadge, Textarea, Modal } from "./ui";

function Comments({ entityId }: { entityId: string }) {
  const db = useDb();
  const [text, setText] = useState("");
  const list = db.comments.filter((c) => c.entityId === entityId);
  return (
    <div>
      <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-mute">Comments ({list.length})</h3>
      <ul className="space-y-3">
        {list.map((c) => (
          <li key={c.id} className="flex gap-2.5">
            <Avatar id={c.userId} size={26} />
            <div className="min-w-0 flex-1 rounded-md bg-paper px-3 py-2">
              <p className="text-[12px] text-mute"><b className="text-ink">{getUser(c.userId)?.name}</b> · {fmtTs(c.ts)}</p>
              <p className="text-[14px]">{c.text}</p>
            </div>
          </li>
        ))}
        {!list.length && <li className="text-[13px] text-mute">No comments yet.</li>}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          addComment(entityId, text.trim());
          setText("");
          toast("Comment added.");
        }}
      >
        <input aria-label="Add a comment" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment" className="h-9 min-w-0 flex-1 rounded-md border border-line px-2.5 text-[14px]" />
        <Btn type="submit" variant="primary"><Send size={14} /> Post</Btn>
      </form>
    </div>
  );
}

const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-4 border-b border-line py-2 text-[14px] last:border-0">
    <dt className="text-mute">{k}</dt>
    <dd className="text-right font-medium">{children}</dd>
  </div>
);

export function BlockerDrawer() {
  const { blockerId } = useUI();
  const db = useDb();
  const b = db.blockers.find((x) => x.id === blockerId);
  const [mode, setMode] = useState<"" | "escalate" | "resolve">("");
  const [note, setNote] = useState("");
  const [to, setTo] = useState("u-owner");
  const close = () => { ui({ blockerId: undefined }); setMode(""); setNote(""); };
  if (!b) return null;
  const vendor = db.vendors.find((v) => v.id === b.vendorId);
  const project = db.projects.find((p) => p.id === b.projectId);
  const resolved = b.status === "Resolved";
  return (
    <Drawer
      open
      onClose={close}
      width="max-w-2xl"
      title={<span className="flex flex-wrap items-center gap-2"><span className="font-mono text-[16px] normal-case">{b.id}</span> <StatusBadge s={b.severity} /> <StatusBadge s={b.status} /></span>}
      sub={<button className="inline-flex items-center gap-1 font-semibold text-brand hover:underline" onClick={() => { close(); navigate(`project/${b.projectId}`); }}>{b.projectId} · {project?.customer} <ArrowUpRight size={13} /></button>}
      footer={
        resolved ? (
          <p className="flex items-center gap-2 text-[14px] text-ok"><CheckCircle2 size={16} /> Resolved — {b.resolution}</p>
        ) : mode === "escalate" ? (
          <div className="space-y-2">
            <Select label="Escalate to" value={to} onChange={(e) => setTo(e.target.value)} options={userOptions} />
            <Textarea label="Escalation note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ask vendor MD to commit a firm date by 10 Oct." />
            <div className="flex gap-2"><Btn variant="danger" onClick={() => { escalateBlocker(b.id, to, note); toast(`Escalated to ${getUser(to)?.name}. Activity recorded.`); setMode(""); setNote(""); }}>Confirm escalation</Btn><Btn onClick={() => setMode("")}>Cancel</Btn></div>
          </div>
        ) : mode === "resolve" ? (
          <div className="space-y-2">
            <Textarea label="Resolution" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Describe how the blocker was resolved" />
            <div className="flex gap-2"><Btn variant="success" onClick={() => { if (!note.trim()) return toast("Describe the resolution first.", "bad"); resolveBlocker(b.id, note); toast(`${b.id} resolved.`); setMode(""); setNote(""); }}>Mark resolved</Btn><Btn onClick={() => setMode("")}>Cancel</Btn></div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Btn variant="danger" onClick={() => setMode("escalate")}><ShieldAlert size={15} /> Escalate</Btn>
            <Btn variant="success" onClick={() => setMode("resolve")}><CheckCircle2 size={15} /> Resolve</Btn>
            {vendor && <Btn onClick={() => { close(); navigate(`vendor/${vendor.id}`); }}>View vendor</Btn>}
          </div>
        )
      }
    >
      <h3 className="text-[19px] font-semibold leading-6">{b.title}</h3>
      <p className="mt-1 text-[14px] text-mute">{b.description}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Select label="Severity" value={b.severity} disabled={resolved} onChange={(e) => { updateBlocker(b.id, { severity: e.target.value as Priority }); toast("Severity updated."); }} options={["Critical", "High", "Medium", "Low"]} />
        <Select label="Status" value={b.status} disabled={resolved} onChange={(e) => { updateBlocker(b.id, { status: e.target.value as BlockerStatus }); toast("Status updated."); }} options={["Open", "Investigating", "Waiting", "Escalated", ...(resolved ? ["Resolved"] : [])]} />
        <Select label="Owner" value={b.owner} disabled={resolved} onChange={(e) => { updateBlocker(b.id, { owner: e.target.value }); toast(`Assigned to ${getUser(e.target.value)?.name}.`); }} options={userOptions} />
        <Input label="Revised forecast" type="date" disabled={resolved} value={b.forecast ?? ""} onChange={(e) => e.target.value && updateBlocker(b.id, { forecast: e.target.value })} />
      </div>

      <dl className="mt-4 rounded-lg border border-line px-3">
        <Row k="Category"><Badge tone="idle">{b.category}</Badge></Row>
        {vendor && <Row k="Vendor"><button onClick={() => { close(); navigate(`vendor/${vendor.id}`); }} className="text-brand hover:underline">{vendor.name}</button></Row>}
        <Row k="Created">{fmtDate(b.created)} · {blockerAge(b)}d old</Row>
        <Row k="Due">{fmtDate(b.due)}</Row>
        <Row k="Schedule impact"><span className={b.scheduleImpact ? "text-bad" : ""}>{b.scheduleImpact ? `+${b.scheduleImpact} days` : "None"}</span></Row>
        <Row k="Cost exposure"><span className="tnum">{b.costImpact ? inr(b.costImpact) : "—"}</span></Row>
        <Row k="Business impact">{b.impact}</Row>
      </dl>

      {b.actions.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-mute">Recommended actions</h3>
          <ul className="space-y-1">
            {b.actions.map((a) => (
              <li key={a.label}>
                <label className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 text-[14px] hover:bg-paper">
                  <input type="checkbox" checked={a.done} disabled={resolved} onChange={() => toggleBlockerAction(b.id, a.label)} className="size-4 accent-[#1b5bd0]" />
                  <span className={a.done ? "text-mute line-through" : ""}>{a.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {b.attachments.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-mute">Attachments</h3>
          <div className="flex flex-wrap gap-2">{b.attachments.map((a) => <span key={a} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[13px]"><Paperclip size={13} />{a}</span>)}</div>
        </div>
      )}
      <div className="mt-5"><Comments entityId={b.id} /></div>
    </Drawer>
  );
}

export function TaskDrawer() {
  const { taskId } = useUI();
  const db = useDb();
  const t = db.tasks.find((x) => x.id === taskId);
  const [edit, setEdit] = useState(false);
  const close = () => { ui({ taskId: undefined }); setEdit(false); };
  if (!t) return null;
  const st = effectiveTaskStatus(t);
  const dep = db.tasks.find((x) => x.id === t.dependency);
  return (
    <Drawer
      open
      onClose={close}
      title={<span className="flex flex-wrap items-center gap-2"><span className="font-mono text-[16px] normal-case">{t.id}</span><StatusBadge s={st} /><StatusBadge s={t.priority} dot={false} /></span>}
      sub={<button className="font-semibold text-brand hover:underline" onClick={() => { close(); navigate(`project/${t.projectId}`); }}>{t.projectId}</button>}
      footer={<div className="flex gap-2">{t.status !== "Completed" && <Btn variant="success" onClick={() => { updateTask(t.id, { status: "Completed" }); toast(`${t.id} marked complete.`); }}><CheckCircle2 size={15} /> Mark complete</Btn>}<Btn onClick={() => setEdit(true)}>Edit all fields</Btn></div>}
    >
      <h3 className="text-[19px] font-semibold leading-6">{t.name}</h3>
      <p className="mt-1 text-[14px] text-mute">{t.notes || "No notes."}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Select label="Status" value={t.status} onChange={(e) => { updateTask(t.id, { status: e.target.value as TaskStatus }); toast("Status updated."); }} options={["Not Started", "In Progress", "Waiting", "Blocked", "Completed"]} />
        <Select label="Owner" value={t.owner} onChange={(e) => { updateTask(t.id, { owner: e.target.value }); toast(`Assigned to ${getUser(e.target.value)?.name}.`); }} options={userOptions} />
        <Input label="Due date" type="date" value={t.due} onChange={(e) => e.target.value && updateTask(t.id, { due: e.target.value })} />
        <Select label="Priority" value={t.priority} onChange={(e) => updateTask(t.id, { priority: e.target.value as Priority })} options={["Critical", "High", "Medium", "Low"]} />
      </div>
      <dl className="mt-4 rounded-lg border border-line px-3">
        <Row k="Workstream">{t.workstream}</Row>
        <Row k="Start">{fmtDate(t.start)}</Row>
        <Row k="Dependency">{dep ? <button className="text-brand hover:underline" onClick={() => ui({ taskId: dep.id })}>{dep.id} — {dep.name}</button> : "None"}</Row>
        <Row k="Hours (actual / estimate)"><span className="tnum">{t.actHours} / {t.estHours} h</span></Row>
      </dl>
      <div className="mt-4">
        <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-mute">Attachments</h3>
        <div className="flex flex-wrap items-center gap-2">
          {t.attachments.map((a) => <span key={a} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[13px]"><FileText size={13} />{a}</span>)}
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-[#b4bfd0] px-2.5 text-[13px] font-semibold text-mute hover:border-brand hover:text-brand">
            <Paperclip size={13} /> Attach document
            <input type="file" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { updateTask(t.id, { attachments: [...t.attachments, f.name] }); toast(`${f.name} attached.`); } }} />
          </label>
        </div>
      </div>
      <div className="mt-5"><Comments entityId={t.id} /></div>
      <Modal open={edit} onClose={() => setEdit(false)} title="Edit task"><TaskForm taskId={t.id} onDone={() => setEdit(false)} /></Modal>
    </Drawer>
  );
}
