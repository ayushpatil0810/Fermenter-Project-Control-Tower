import type { Blocker, DB, Health, Priority, Project, Task, TaskStatus } from "@/types";

export const TODAY = "2026-10-09";
export const NOW_TS = "2026-10-09T10:50";

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

const MS = 86400000;
const parse = (s: string) => new Date(s.slice(0, 10) + "T00:00:00Z").getTime();
export const diffDays = (from: string, to: string) => Math.round((parse(to) - parse(from)) / MS);
export const addDays = (s: string, n: number) => new Date(parse(s) + n * MS).toISOString().slice(0, 10);
export const daysFromToday = (s: string) => diffDays(TODAY, s);

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtDate = (s?: string) => {
  if (!s) return "—";
  const d = new Date(parse(s));
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MON[d.getUTCMonth()]}`;
};
export const fmtDateY = (s?: string) => (s ? `${fmtDate(s)} ${s.slice(0, 4)}` : "—");

const time12 = (ts: string) => {
  const [h, m] = ts.slice(11, 16).split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
export const fmtTs = (ts: string) => {
  const d = diffDays(TODAY, ts);
  if (d === 0) return time12(ts);
  if (d === -1) return `Yesterday ${time12(ts)}`;
  return `${fmtDate(ts)}, ${time12(ts)}`;
};
export const dayLabel = (ts: string) => {
  const d = diffDays(TODAY, ts);
  return d === 0 ? "Today" : d === -1 ? "Yesterday" : fmtDateY(ts);
};

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
export const lakh = (n: number) => `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 2)} L`;
export const crore = (n: number) => `₹${(n / 10000000).toFixed(2)} Cr`;

export const daysRemaining = (delivery: string) => {
  const d = daysFromToday(delivery);
  if (d === 0) return { text: "Due today", tone: "warn" as const, d };
  if (d < 0) return { text: `${-d} day${d === -1 ? "" : "s"} overdue`, tone: "bad" as const, d };
  return { text: `${d} days remaining`, tone: d <= 7 ? ("warn" as const) : ("ok" as const), d };
};

export const effectiveTaskStatus = (t: Task): TaskStatus =>
  t.status !== "Completed" && t.due < TODAY ? "Overdue" : t.status;

export const sevRank: Record<Priority, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

export const milestoneDelay = (m: { planned: string; forecast: string }) => diffDays(m.planned, m.forecast);
export const milestoneStatus = (pct: number) => (pct >= 100 ? "Completed" : pct > 0 ? "In Progress" : "Upcoming");

export const openBlockers = (db: DB, projectId?: string) =>
  db.blockers.filter((b) => b.status !== "Resolved" && (!projectId || b.projectId === projectId));

export function assessHealth(db: DB, p: Project): { health: Health; reason: string } {
  const bl = openBlockers(db, p.id);
  const crit = bl.find((b) => b.severity === "Critical");
  const ms = db.milestones.filter((m) => m.projectId === p.id && m.pct < 100);
  const maxDelay = Math.max(0, ...ms.map(milestoneDelay));
  const cust = bl.find((b) => b.category === "Customer");
  if (crit) return { health: "Blocked", reason: `Critical blocker: ${crit.title}.` };
  if (maxDelay > 5) return { health: "Blocked", reason: `A milestone is forecast ${maxDelay} days late.` };
  if (cust && cust.severity === "Critical")
    return { health: "Blocked", reason: "Customer approval blocks the next stage." };
  const high = bl.find((b) => b.severity === "High");
  if (high) return { health: "At Risk", reason: `High-priority blocker: ${high.title}.` };
  if (maxDelay >= 2) return { health: "At Risk", reason: `Milestone delay of ${maxDelay} days forecast.` };
  return { health: "On Track", reason: "No critical blockers; milestones within tolerance." };
}

export interface RiskFactor {
  label: string;
  points: number;
}
export function riskScore(db: DB, p: Project): { score: number; label: string; factors: RiskFactor[] } {
  const bl = openBlockers(db, p.id);
  const ms = db.milestones.filter((m) => m.projectId === p.id && m.pct < 100);
  const maxDelay = Math.max(0, ...ms.map(milestoneDelay));
  const sched = Math.min(25, maxDelay * 4);
  const sev = Math.min(
    35,
    bl.reduce((s, b) => s + ({ Critical: 35, High: 16, Medium: 7, Low: 2 } as const)[b.severity], 0),
  );
  const delayedPO = db.purchaseOrders.filter((o) => o.projectId === p.id && poDelay(o) > 0 && !o.actual);
  const proc = Math.min(15, delayedPO.length * 10);
  const vIds = new Set(db.workPackages.filter((w) => w.projectId === p.id && w.status !== "Delivered").map((w) => w.vendorId));
  const weakVendors = db.vendors.filter((v) => vIds.has(v.id) && v.onTime < 90).length;
  const vend = Math.min(10, weakVendors * 8);
  const cust = bl.some((b) => b.category === "Customer") ? 10 : 0;
  const od = db.tasks.filter((t) => t.projectId === p.id && effectiveTaskStatus(t) === "Overdue").length;
  const over = Math.min(10, od * 5);
  const factors = [
    { label: `Schedule delay (+${maxDelay}d on forecast)`, points: sched },
    { label: `Open blocker severity (${bl.length} open)`, points: sev },
    { label: `Procurement delays (${delayedPO.length})`, points: proc },
    { label: "Vendor reliability below 90%", points: vend },
    { label: "Customer approval pending", points: cust },
    { label: `Overdue tasks (${od})`, points: over },
  ].filter((f) => f.points > 0);
  const score = Math.min(100, factors.reduce((s, f) => s + f.points, 0));
  return { score, label: score >= 65 ? "HIGH RISK" : score >= 35 ? "MEDIUM RISK" : "LOW RISK", factors };
}

export const poDelay = (o: { required: string; expected: string; actual?: string; status: string }) => {
  if (o.actual) return Math.max(0, diffDays(o.required, o.actual));
  if (["Received", "Accepted", "QC Pending"].includes(o.status)) return 0;
  return Math.max(0, diffDays(o.required, o.expected), o.expected < TODAY ? diffDays(o.expected, TODAY) : 0);
};

export const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 7)}`;
export const initials = (n: string) =>
  n
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");

export const blockerAge = (b: Blocker) => Math.max(0, diffDays(b.created, b.status === "Resolved" ? b.due : TODAY));
