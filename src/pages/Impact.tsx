import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from "recharts";
import { Clock, FileBarChart, Gauge, IndianRupee, Radar, Sparkles, Download } from "lucide-react";
import { getDashboardMetrics, useDb } from "@/services/db";
import { toast } from "@/services/ui";
import { impactSeed } from "@/data/seed";
import { COMPANY } from "@/data/seed";
import { fmtDateY, TODAY, lakh } from "@/utils";
import { Badge, Btn, Kpi, Loader, Modal, PageHeader, Panel } from "@/components/ui";

const C = { base: "#98a4b8", pilot: "#1b5bd0", ok: "#0f7d45", warn: "#d98a00", bad: "#c02525" };
const pct = (a: number, b: number) => Math.round(((a - b) / a) * 100);

const ROADMAP = [
  ["Delay prediction", "Forecast milestone slippage from vendor history, open blockers and weld-hours trends."],
  ["Auto-generated daily reports", "Plain-language shift and project summaries drafted from the activity feed."],
  ["Vendor risk scoring", "Rank vendors on delivery reliability, quality rejects and responsiveness."],
  ["Voice and WhatsApp updates", "Shop-floor and site teams report by voice note or WhatsApp message."],
  ["Drawing and document comparison", "Highlight what changed between revisions before release."],
];

export default function Impact() {
  const db = useDb();
  const m = getDashboardMetrics();
  const [open, setOpen] = useState(false);
  const i = impactSeed;
  const trend = [...i.healthTrend, { month: "Oct", onTrack: m.onTrack, atRisk: m.atRisk, blocked: m.blocked }];
  const kpis = [
    { label: "Update-chasing time", value: `-${pct(i.updateChasing.baseline, i.updateChasing.pilot)}%`, sub: `${i.updateChasing.baseline} → ${i.updateChasing.pilot} hrs/week per PM`, icon: <Clock size={16} /> },
    { label: "Blocker discovery time", value: `-${pct(i.blockerDiscovery.baseline, i.blockerDiscovery.pilot)}%`, sub: `${i.blockerDiscovery.baseline} days → ${i.blockerDiscovery.pilot} days`, icon: <Radar size={16} /> },
    { label: "Milestone adherence", value: `+${i.milestones.pilot - i.milestones.baseline} pts`, sub: `${i.milestones.baseline}% → ${i.milestones.pilot}% on time`, icon: <Gauge size={16} /> },
    { label: "Delay cost", value: `-${pct(i.delayCost.baseline, i.delayCost.pilot)}%`, sub: `₹${i.delayCost.baseline} L → ₹${i.delayCost.pilot} L per month`, icon: <IndianRupee size={16} /> },
  ];
  const sections: [string, string][] = [
    ["1. Executive summary", `Over the pilot, ${COMPANY.name} moved project tracking from scattered calls and spreadsheets into one control tower covering ${m.active} active projects worth ${lakh(m.portfolioValue)}.`],
    ["2. Pilot scope", "Eight active fermenter and bioreactor projects, eight vendors, three install teams, 11 delivery stages per project."],
    ["3. Baseline vs pilot", `Milestone adherence ${i.milestones.baseline}% → ${i.milestones.pilot}%; update-chasing ${i.updateChasing.baseline} → ${i.updateChasing.pilot} hrs/week; blocker discovery ${i.blockerDiscovery.baseline} → ${i.blockerDiscovery.pilot} days.`],
    ["4. Portfolio health", `Today: ${m.onTrack} on track, ${m.atRisk} at risk, ${m.blocked} blocked. ${lakh(m.revenueAtRisk)} of contract value is not on track.`],
    ["5. Blockers and escalations", `${m.openBlockers} open blockers (${m.criticalBlockers} critical) with ${lakh(m.costExposure)} cost exposure. Average open age ${m.avgBlockerAge} days.`],
    ["6. Vendor performance", `${m.vendorDelays} vendors currently at risk; ${m.delayedPOs} purchase orders delayed. Alternate vendor identified for shaft machining.`],
    ["7. Time and cost savings", `Estimated delay cost reduction of ${pct(i.delayCost.baseline, i.delayCost.pilot)}% (₹${i.delayCost.baseline} L → ₹${i.delayCost.pilot} L per month).`],
    ["8. Lessons learned", "Single ownership per blocker and a named due date changed behaviour fastest. Photo evidence from the floor cut verification calls."],
    ["9. Recommendation", "Extend to all active projects, add WhatsApp intake, and begin Phase 2 delay prediction once 90 days of data are captured."],
  ];
  return (
    <Loader>
      <PageHeader title="Reports & Impact" sub="Measured value of the control tower during the pilot." actions={<Btn variant="primary" onClick={() => setOpen(true)}><FileBarChart size={16} /> Generate Impact Report</Btn>} />
      <div className="mb-3 flex items-center gap-2"><Badge tone="warn" className="uppercase tracking-wider">Dummy pilot data</Badge><span className="text-[13px] text-mute">Baseline and pilot figures are illustrative for this demo.</span></div>
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((k) => <Kpi key={k.label} label={k.label} value={k.value} sub={k.sub} tone="ok" icon={k.icon} />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Milestone adherence" sub="% of milestones delivered on plan">
          <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={[{ n: "Baseline", v: i.milestones.baseline }, { n: "Pilot", v: i.milestones.pilot }]} margin={{ left: -16, top: 8 }}><CartesianGrid stroke="#e3e8f0" vertical={false} /><XAxis dataKey="n" /><YAxis domain={[0, 100]} /><Tooltip /><Bar dataKey="v" name="On-time %" fill={C.pilot} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Blocker discovery time" sub="Days from issue occurring to being visible">
          <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={[{ n: "Baseline", v: i.blockerDiscovery.baseline }, { n: "Pilot", v: i.blockerDiscovery.pilot }]} margin={{ left: -16, top: 8 }}><CartesianGrid stroke="#e3e8f0" vertical={false} /><XAxis dataKey="n" /><YAxis /><Tooltip /><Bar dataKey="v" name="Days" fill={C.ok} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Update-chasing time" sub="Hours per PM per week spent asking for status">
          <div className="h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={[{ n: "Baseline", v: i.updateChasing.baseline }, { n: "Wk 2", v: 6.1 }, { n: "Wk 4", v: 4.4 }, { n: "Pilot", v: i.updateChasing.pilot }]} margin={{ left: -16, top: 8 }}><CartesianGrid stroke="#e3e8f0" vertical={false} /><XAxis dataKey="n" /><YAxis /><Tooltip /><Area type="monotone" dataKey="v" name="Hours / week" stroke={C.pilot} fill="#dbe7fb" strokeWidth={2} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Project health trend" sub="Jul–Sep pilot data · October is live from this app">
          <div className="h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{ left: -16, top: 8 }}><CartesianGrid stroke="#e3e8f0" vertical={false} /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Line dataKey="onTrack" name="On track" stroke={C.ok} strokeWidth={2} isAnimationActive={false} /><Line dataKey="atRisk" name="At risk" stroke={C.warn} strokeWidth={2} isAnimationActive={false} /><Line dataKey="blocked" name="Blocked" stroke={C.bad} strokeWidth={2} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
        </Panel>
      </div>

      <Panel title="Coming in Phase 2" sub="AI roadmap — not part of this MVP" className="mt-4">
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ROADMAP.map(([t, d]) => (
            <li key={t} className="rounded-lg border border-dashed border-[#b4bfd0] bg-paper p-3"><p className="flex items-center gap-2 font-semibold"><Sparkles size={15} className="text-eng" />{t}</p><p className="mt-1 text-[13.5px] text-mute">{d}</p></li>
          ))}
        </ul>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} width="max-w-2xl" title="Impact report" footer={<><Btn onClick={() => setOpen(false)}>Close</Btn><Btn variant="primary" onClick={() => toast("PDF export is available in the production version.", "info")}><Download size={16} /> Export PDF</Btn></>}>
        <p className="mb-3 text-[13px] text-mute">{COMPANY.name} · generated {fmtDateY(TODAY)} · <b>dummy pilot data</b></p>
        <div className="space-y-4">{sections.map(([h, t]) => <section key={h}><h3 className="font-display text-[17px] font-semibold uppercase tracking-wide">{h}</h3><p className="text-[14.5px]">{t}</p></section>)}</div>
      </Modal>
    </Loader>
  );
}
