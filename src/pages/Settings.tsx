import { useState } from "react";
import { RotateCcw, ShieldAlert } from "lucide-react";
import { resetDemoData, useSession } from "@/services/db";
import { toast, ui, useUI } from "@/services/ui";
import { COMPANY, users } from "@/data/seed";
import { Badge, Btn, Loader, Modal, PageHeader, Panel } from "@/components/ui";
import { MiniStat } from "@/components/domain";

export default function Settings() {
  const { simulateError } = useUI();
  const session = useSession();
  const [confirm, setConfirm] = useState(false);
  return (
    <Loader>
      <PageHeader title="Settings" sub="Company profile, demo accounts and demo controls." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Company profile">
          <div className="grid grid-cols-2 gap-4">
            <MiniStat k="Company" v={COMPANY.name} />
            <MiniStat k="Location" v={COMPANY.location} />
            <MiniStat k="Segment" v="MSME · stainless-steel process equipment" />
            <MiniStat k="Plan" v={<Badge tone="warn">Demo</Badge>} />
          </div>
        </Panel>
        <Panel title="Demo controls" sub="For presentations and testing">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-semibold">Reset demo data</p><p className="text-[13.5px] text-mute">Restores all projects, blockers, tasks and activity to the starting dataset.</p></div>
              <Btn variant="danger" onClick={() => setConfirm(true)}><RotateCcw size={15} /> Reset</Btn>
            </div>
            <div className="flex items-start justify-between gap-3 border-t border-line pt-4">
              <div><p className="font-semibold">Simulate loading error</p><p className="text-[13.5px] text-mute">Shows the “Unable to load project updates.” state with a Try again button.</p></div>
              <label className="flex shrink-0 items-center gap-2 text-[14px] font-semibold"><input type="checkbox" checked={simulateError} onChange={(e) => ui({ simulateError: e.target.checked })} className="size-5 accent-brand" />Enabled</label>
            </div>
          </div>
        </Panel>
        <Panel title="Demo accounts" className="lg:col-span-2" flush>
          <ul className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
            {users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 border-line px-4 py-2.5 sm:border-b">
                <div className="min-w-0 flex-1"><p className="font-semibold">{u.name}{session?.userId === u.id && <Badge tone="brand" className="ml-2">You</Badge>}</p><p className="truncate text-[12.5px] text-mute">{u.title} · {u.email}</p></div>
                <Badge tone="idle">{u.role}</Badge>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Security & access" className="lg:col-span-2">
          <p className="flex items-start gap-2 text-[14px] text-mute"><ShieldAlert size={18} className="mt-0.5 shrink-0 text-warn" />Demo mode accepts any password and stores data in this browser only. Production uses single sign-on, per-role permissions and a server-side audit log.</p>
        </Panel>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Reset demo data?" footer={<><Btn onClick={() => setConfirm(false)}>Cancel</Btn><Btn variant="danger" onClick={() => { resetDemoData(); setConfirm(false); toast("Demo data reset to the starting dataset."); }}>Reset everything</Btn></>}>
        <p className="text-[14.5px]">All changes you made in this browser (tasks, blockers, updates, documents) will be discarded.</p>
      </Modal>
    </Loader>
  );
}
