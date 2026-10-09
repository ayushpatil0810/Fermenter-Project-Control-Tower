/**
 * Mock data service. Every function here is the seam where a REST / Supabase
 * call can later be substituted; UI components never touch seed data directly.
 */
import { buildSeed, DEFAULT_USER, users } from "@/data/seed";
import type {
  Activity,
  AppNotification,
  Blocker,
  DB,
  DocumentRec,
  FieldUpdate,
  Milestone,
  POStatus,
  Project,
  ShopFloorUpdate,
  Task,
  User,
  Role,
  VendorWorkPackage,
} from "@/types";
import { NOW_TS, TODAY, diffDays, effectiveTaskStatus, openBlockers, poDelay, uid, milestoneDelay } from "@/utils";
import { createStore } from "./store";

const KEY = "pbf-demo-db-v2";
const load = (): DB => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DB;
  } catch {
    /* ignore */
  }
  return buildSeed();
};

export const dbStore = createStore<DB>(load());
export const useDb = dbStore.use;
export const getDb = () => transactionDb ?? dbStore.get();
let transactionDb: DB | null = null;
const commit = (fn: (db: DB) => DB) => {
  if (transactionDb) {
    transactionDb = fn(transactionDb);
    return;
  }
  dbStore.set((s) => {
    const next = fn(s);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    return next;
  });
};
/** Stage all shared-service changes, persist once, then publish once. */
export const atomicDemoWrite = (operation: () => void) => {
  if (transactionDb) throw new Error("Another update is in progress.");
  transactionDb = dbStore.get();
  try {
    operation();
    const next = transactionDb;
    localStorage.setItem(KEY, JSON.stringify(next));
    dbStore.set(next);
  } finally {
    transactionDb = null;
  }
};
export const resetDemoData = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  dbStore.set(buildSeed());
};

/* ---------- session ---------- */
export interface Session {
  userId: string;
  role: Role;
}
const SKEY = "pbf-demo-session";
const loadSession = (): Session | null => {
  try {
    const s = localStorage.getItem(SKEY);
    return s ? (JSON.parse(s) as Session) : null;
  } catch {
    return null;
  }
};
export const sessionStore = createStore<Session | null>(loadSession());
export const useSession = sessionStore.use;
const persistSession = (s: Session | null) => {
  try {
    if (s) localStorage.setItem(SKEY, JSON.stringify(s));
    else localStorage.removeItem(SKEY);
  } catch {
    /* ignore */
  }
};
export const login = (email: string, role: Role) => {
  const u = users.find((x) => x.email === email.trim().toLowerCase());
  const s: Session = { userId: u && u.role === role ? u.id : DEFAULT_USER[role], role };
  sessionStore.set(s);
  persistSession(s);
};
export const logout = () => {
  sessionStore.set(null);
  persistSession(null);
};
export const switchRole = (role: Role) => {
  const s = { userId: DEFAULT_USER[role], role };
  sessionStore.set(s);
  persistSession(s);
};
export const getUser = (id?: string): User | undefined => users.find((u) => u.id === id);
export const currentUserId = () => sessionStore.get()?.userId ?? "u-rk";

/* ---------- activity & notifications ---------- */
export const createActivity = (a: Omit<Activity, "id" | "ts" | "userId"> & { userId?: string }) =>
  commit((db) => ({
    ...db,
    activities: [{ id: uid("ACT"), ts: NOW_TS, userId: a.userId ?? currentUserId(), ...a }, ...db.activities],
  }));
const notify = (n: Omit<AppNotification, "id" | "ts" | "read">) =>
  commit((db) => ({ ...db, notifications: [{ id: uid("N"), ts: NOW_TS, read: false, ...n }, ...db.notifications] }));
export const markAllRead = () =>
  commit((db) => ({ ...db, notifications: db.notifications.map((n) => ({ ...n, read: true })) }));
export const markRead = (id: string) =>
  commit((db) => ({ ...db, notifications: db.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));

/* ---------- projects ---------- */
export const getProjects = () => getDb().projects;
export const getProject = (id: string) => getDb().projects.find((p) => p.id === id);
export const createProject = (p: Project) => {
  commit((db) => ({ ...db, projects: [p, ...db.projects] }));
  createActivity({ projectId: p.id, action: "created a project", description: `${p.id} — ${p.equipment} for ${p.customer}.`, kind: "update" });
};
export const updateProject = (id: string, patch: Partial<Project>, note?: string) => {
  const before = getProject(id);
  if (!before) return;
  commit((db) => ({ ...db, projects: db.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const parts: string[] = [];
  if (patch.progress !== undefined && patch.progress !== before.progress) parts.push(`Progress ${before.progress}% → ${patch.progress}%.`);
  if (patch.health && patch.health !== before.health) parts.push(`Health ${before.health} → ${patch.health}.`);
  if (patch.stage && patch.stage !== before.stage) parts.push(`Stage ${before.stage} → ${patch.stage}.`);
  if (patch.currentRisk !== undefined && patch.currentRisk !== before.currentRisk) parts.push(`Risk updated: ${patch.currentRisk || "cleared"}.`);
  if (note) parts.push(note);
  if (parts.length) createActivity({ projectId: id, action: "updated project", description: parts.join(" "), kind: "update" });
};

/* ---------- tasks ---------- */
export const getTasks = (projectId?: string) => getDb().tasks.filter((t) => !projectId || t.projectId === projectId);
export const createTask = (t: Omit<Task, "id" | "attachments" | "actHours"> & Partial<Pick<Task, "attachments" | "actHours">>) => {
  const id = `T-${130 + getDb().tasks.length}`;
  commit((db) => ({ ...db, tasks: [{ attachments: [], actHours: 0, ...t, id }, ...db.tasks] }));
  createActivity({ projectId: t.projectId, action: "created a task", description: `${t.name} assigned to ${getUser(t.owner)?.name}.`, kind: "task" });
  if (t.owner === currentUserId()) notify({ tone: "info", title: "Task assigned to you", body: `${t.name} (${t.projectId})`, link: { page: "tasks", id, kind: "task" } });
  return id;
};
export const updateTask = (id: string, patch: Partial<Task>) => {
  const before = getDb().tasks.find((t) => t.id === id);
  if (!before) return;
  commit((db) => ({ ...db, tasks: db.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const parts: string[] = [];
  if (patch.status && patch.status !== before.status) parts.push(`status ${before.status} → ${patch.status}`);
  if (patch.owner && patch.owner !== before.owner) parts.push(`owner → ${getUser(patch.owner)?.name}`);
  if (patch.due && patch.due !== before.due) parts.push(`due date → ${patch.due}`);
  if (patch.priority && patch.priority !== before.priority) parts.push(`priority → ${patch.priority}`);
  if (parts.length)
    createActivity({ projectId: before.projectId, action: "updated a task", description: `${before.name}: ${parts.join(", ")}.`, kind: "task" });
  if (patch.owner && patch.owner !== before.owner && patch.owner === currentUserId())
    notify({ tone: "info", title: "Task assigned to you", body: `${before.name} (${before.projectId})`, link: { page: "tasks", id, kind: "task" } });
  if (patch.due && patch.due < TODAY && (patch.status ?? before.status) !== "Completed")
    notify({ tone: "warning", title: "Task overdue", body: `${before.name} for ${before.projectId} is overdue.`, link: { page: "tasks", id, kind: "task" } });
};
export const addComment = (entityId: string, text: string) => {
  commit((db) => ({ ...db, comments: [...db.comments, { id: uid("C"), entityId, userId: currentUserId(), text, ts: NOW_TS }] }));
};

/* ---------- blockers ---------- */
export const getBlockers = (projectId?: string) => getDb().blockers.filter((b) => !projectId || b.projectId === projectId);
export const createBlocker = (b: Partial<Blocker> & Pick<Blocker, "projectId" | "title" | "category" | "severity" | "owner">) => {
  const nums = getDb().blockers.map((x) => Number(x.id.slice(4)) || 0);
  const id = `BLK-${String(Math.max(40, ...nums) + 1).padStart(3, "0")}`;
  const full: Blocker = {
    description: "",
    status: "Open",
    created: TODAY,
    due: TODAY,
    impact: "Impact under assessment.",
    costImpact: 0,
    scheduleImpact: 0,
    attachments: [],
    actions: [],
    ...b,
    id,
  };
  commit((db) => ({ ...db, blockers: [full, ...db.blockers] }));
  createActivity({ projectId: b.projectId, action: "created a blocker", description: `${id} created: ${b.title} (${b.severity}).`, kind: "blocker" });
  if (b.severity === "Critical")
    notify({ tone: "critical", title: "Critical blocker created", body: `${b.projectId} is blocked: ${b.title}.`, link: { page: "blockers", id, kind: "blocker" } });
  return id;
};
export const updateBlocker = (id: string, patch: Partial<Blocker>) => {
  const before = getDb().blockers.find((b) => b.id === id);
  if (!before) return;
  commit((db) => ({ ...db, blockers: db.blockers.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  const parts: string[] = [];
  if (patch.severity && patch.severity !== before.severity) parts.push(`severity ${before.severity} → ${patch.severity}`);
  if (patch.status && patch.status !== before.status) parts.push(`status ${before.status} → ${patch.status}`);
  if (patch.owner && patch.owner !== before.owner) parts.push(`owner → ${getUser(patch.owner)?.name}`);
  if (patch.forecast && patch.forecast !== before.forecast) parts.push(`forecast → ${patch.forecast}`);
  if (parts.length)
    createActivity({ projectId: before.projectId, action: "updated a blocker", description: `${id}: ${parts.join(", ")}.`, kind: "blocker" });
  if (patch.severity === "Critical" && before.severity !== "Critical")
    notify({ tone: "critical", title: "Blocker escalated to Critical", body: `${id}: ${before.title}`, link: { page: "blockers", id, kind: "blocker" } });
};
export const resolveBlocker = (id: string, resolution: string) => {
  const b = getDb().blockers.find((x) => x.id === id);
  if (!b) return;
  commit((db) => ({ ...db, blockers: db.blockers.map((x) => (x.id === id ? { ...x, status: "Resolved", resolution, due: x.due } : x)) }));
  createActivity({ projectId: b.projectId, action: "resolved a blocker", description: `${id} resolved: ${resolution}`, kind: "blocker" });
  notify({ tone: "success", title: "Blocker resolved", body: `${id} — ${b.title}`, link: { page: "blockers", id, kind: "blocker" } });
};
export const escalateBlocker = (id: string, toUserId: string, note: string) => {
  const b = getDb().blockers.find((x) => x.id === id);
  if (!b) return;
  commit((db) => ({
    ...db,
    blockers: db.blockers.map((x) =>
      x.id === id ? { ...x, status: "Escalated", actions: x.actions.map((a) => (a.label === "Escalate vendor" ? { ...a, done: true } : a)) } : x,
    ),
  }));
  addComment(id, `Escalated to ${getUser(toUserId)?.name}. ${note}`);
  createActivity({ projectId: b.projectId, action: "escalated a blocker", description: `${id} escalated to ${getUser(toUserId)?.name}. ${note}`, kind: "blocker" });
  notify({ tone: "warning", title: "Escalation assigned", body: `${id} escalated to ${getUser(toUserId)?.name}.`, link: { page: "blockers", id, kind: "blocker" } });
};
export const toggleBlockerAction = (id: string, label: string) =>
  commit((db) => ({
    ...db,
    blockers: db.blockers.map((b) =>
      b.id === id ? { ...b, actions: b.actions.map((a) => (a.label === label ? { ...a, done: !a.done } : a)) } : b,
    ),
  }));

/* ---------- vendors ---------- */
export const getVendors = () => getDb().vendors;
export const getVendorPerformance = (vendorId: string) => {
  const db = getDb();
  const v = db.vendors.find((x) => x.id === vendorId);
  const wps = db.workPackages.filter((w) => w.vendorId === vendorId);
  return {
    vendor: v,
    wps,
    onTime: v?.onTime ?? 0,
    lateDeliveries: v?.lateDeliveries ?? 0,
    avgDelay: v?.avgDelay ?? 0,
    activeJobs: wps.filter((w) => w.status !== "Delivered").length,
    openBlockers: db.blockers.filter((b) => b.vendorId === vendorId && b.status !== "Resolved").length,
    history: v?.history ?? [],
  };
};
export const updateWorkPackage = (id: string, patch: Partial<VendorWorkPackage>, note?: string) => {
  const before = getDb().workPackages.find((w) => w.id === id);
  if (!before) return;
  commit((db) => ({ ...db, workPackages: db.workPackages.map((w) => (w.id === id ? { ...w, ...patch } : w)) }));
  const v = getDb().vendors.find((x) => x.id === before.vendorId);
  if (patch.forecast && patch.forecast !== before.forecast) {
    const late = diffDays(before.committed, patch.forecast);
    createActivity({
      projectId: before.projectId,
      action: "recorded a vendor forecast",
      description: `${v?.name}: ${before.title} forecast ${before.forecast} → ${patch.forecast}${late > 0 ? ` (+${late}d vs commitment)` : ""}. ${note ?? ""}`.trim(),
      kind: "vendor",
    });
    notify({ tone: "info", title: "Vendor update", body: `${v?.name} revised ${before.title} to ${patch.forecast}.`, link: { page: "vendor", id: before.vendorId } });
    // keep linked blocker and PO in sync
    commit((db) => ({
      ...db,
      blockers: db.blockers.map((b) => (b.vendorId === before.vendorId && b.projectId === before.projectId && b.status !== "Resolved" ? { ...b, forecast: patch.forecast } : b)),
    }));
  }
  if (patch.status === "Delivered") {
    createActivity({ projectId: before.projectId, action: "confirmed delivery", description: `${v?.name} confirmed delivery of ${before.title}.`, kind: "vendor" });
  }
};
export const updateVendor = (id: string, patch: Partial<DB["vendors"][number]>) =>
  commit((db) => ({ ...db, vendors: db.vendors.map((v) => (v.id === id ? { ...v, ...patch } : v)) }));

/* ---------- procurement ---------- */
export const updatePO = (id: string, patch: Partial<DB["purchaseOrders"][number]>, note?: string) => {
  const before = getDb().purchaseOrders.find((p) => p.id === id);
  if (!before) return;
  commit((db) => ({ ...db, purchaseOrders: db.purchaseOrders.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  if (patch.status && patch.status !== before.status)
    createActivity({ projectId: before.projectId, action: "updated procurement", description: `${before.item} (${before.id}): ${before.status} → ${patch.status}. ${note ?? ""}`.trim(), kind: "material" });
};
export const receiveMaterial = (id: string, result: "Accepted" | "Partially Received" | "Rejected", note: string) => {
  const po = getDb().purchaseOrders.find((p) => p.id === id);
  if (!po) return;
  if (result === "Rejected") {
    updatePO(id, { status: "Delayed", actual: undefined }, `Material rejected at QC. ${note}`);
    notify({ tone: "critical", title: "Material rejected", body: `${po.item} for ${po.projectId} failed incoming QC.`, link: { page: "procurement" } });
  } else {
    updatePO(id, { status: result === "Accepted" ? "QC Pending" : "Partially Received", actual: TODAY }, note);
    if (result === "Accepted") updatePO(id, { status: "Accepted" });
  }
};
export const getPOs = () => getDb().purchaseOrders;
export const poStatusOptions: POStatus[] = ["Requested", "RFQ", "PO Issued", "Ordered", "Partially Received", "Received", "QC Pending", "Accepted", "Delayed"];

/* ---------- shop floor & field ---------- */
export const updateShopJob = (id: string, patch: Partial<DB["shopJobs"][number]>) =>
  commit((db) => ({ ...db, shopJobs: db.shopJobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) }));
export const createShopUpdate = (u: Omit<ShopFloorUpdate, "id" | "ts" | "userId">) => {
  const job = getDb().shopJobs.find((j) => j.id === u.jobId);
  commit((db) => ({ ...db, shopUpdates: [{ id: uid("SU"), ts: NOW_TS, userId: currentUserId(), ...u }, ...db.shopUpdates] }));
  const jobStatus = u.status === "Completed" ? "Completed" : u.status === "Blocked" ? "Blocked" : "Running";
  updateShopJob(u.jobId, { progress: u.status === "Completed" ? 100 : u.progress, status: jobStatus });
  createActivity({
    projectId: u.projectId,
    action: u.status === "Blocked" ? "reported a shop-floor issue" : "submitted a shop-floor update",
    description: `${job?.name ?? "Job"} — ${u.status}, ${u.progress}%. "${u.comment}"`,
    kind: u.status === "Blocked" ? "blocker" : "update",
  });
};
export const createFieldUpdate = (u: Omit<FieldUpdate, "id" | "ts" | "userId" | "blockerId">, raiseBlocker: boolean) => {
  let blockerId: string | undefined;
  if (raiseBlocker) {
    blockerId = createBlocker({
      projectId: u.projectId,
      title: u.issueType === "None" ? "Site issue" : `Site issue: ${u.issueType}`,
      description: u.comment,
      category: "Installation",
      severity: u.severity === "None" ? "Medium" : u.severity,
      owner: "u-it",
      due: TODAY,
    });
    notify({ tone: "critical", title: "Field team raised a blocker", body: `${u.projectId}: ${u.comment.slice(0, 80)}`, link: { page: "blockers", id: blockerId, kind: "blocker" } });
  }
  commit((db) => ({ ...db, fieldUpdates: [{ id: uid("FU"), ts: NOW_TS, userId: currentUserId(), blockerId, ...u }, ...db.fieldUpdates] }));
  createActivity({ projectId: u.projectId, action: "submitted a field update", description: `${u.status}. "${u.comment}"`, kind: "field" });
};
export const toggleSiteTask = (jobId: string, name: string) =>
  commit((db) => ({
    ...db,
    siteJobs: db.siteJobs.map((j) => (j.id === jobId ? { ...j, tasks: j.tasks.map((t) => (t.name === name ? { ...t, done: !t.done } : t)) } : j)),
  }));

/* ---------- documents ---------- */
export const createDocument = (d: Omit<DocumentRec, "id" | "date" | "by">) => {
  commit((db) => ({ ...db, documents: [{ ...d, id: uid("DOC"), date: TODAY, by: currentUserId() }, ...db.documents] }));
  createActivity({ projectId: d.projectId, action: "uploaded a document", description: `${d.filename} (${d.type} Rev ${d.rev}).`, kind: "design" });
};
export const updateDocument = (id: string, patch: Partial<DocumentRec>) =>
  commit((db) => ({ ...db, documents: db.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));

export const getActivities = (projectId?: string) => getDb().activities.filter((a) => !projectId || a.projectId === projectId);
export const updateMilestone = (id: string, patch: Partial<Milestone>) => {
  const before = getDb().milestones.find((m) => m.id === id);
  if (!before) return;
  commit((db) => ({ ...db, milestones: db.milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  if (patch.forecast && milestoneDelay({ planned: before.planned, forecast: patch.forecast }) > 0)
    notify({ tone: "warning", title: "Milestone delayed", body: `${before.name} for ${before.projectId} is forecast ${patch.forecast}.`, link: { page: "project", id: before.projectId } });
};

/* ---------- analytics ---------- */
export const getDashboardMetrics = (projectIds?: string[]) => {
  const db = getDb();
  const inScope = (pid: string) => !projectIds || projectIds.includes(pid);
  const ps = db.projects.filter((p) => inScope(p.id));
  const tasks = db.tasks.filter((t) => inScope(t.projectId));
  const open = openBlockers(db).filter((b) => inScope(b.projectId));
  const ms = db.milestones.filter((m) => inScope(m.projectId));
  const due = ms.filter((m) => m.pct === 100 || m.forecast <= TODAY);
  const onTimeMs = due.filter((m) => milestoneDelay(m) <= 0).length;
  return {
    active: ps.length,
    onTrack: ps.filter((p) => p.health === "On Track").length,
    atRisk: ps.filter((p) => p.health === "At Risk").length,
    blocked: ps.filter((p) => p.health === "Blocked").length,
    dueToday: tasks.filter((t) => t.status !== "Completed" && t.due === TODAY).length,
    overdue: tasks.filter((t) => effectiveTaskStatus(t) === "Overdue").length,
    openBlockers: open.length,
    criticalBlockers: open.filter((b) => b.severity === "Critical").length,
    vendorDelays: db.vendors.filter((v) => v.health === "At Risk").length,
    revenueAtRisk: ps.filter((p) => p.health !== "On Track").reduce((s, p) => s + p.value, 0),
    portfolioValue: ps.reduce((s, p) => s + p.value, 0),
    costExposure: open.reduce((s, b) => s + b.costImpact, 0),
    avgProgress: ps.length ? Math.round(ps.reduce((s, p) => s + p.progress, 0) / ps.length) : 0,
    milestoneAdherence: due.length ? Math.round((onTimeMs / due.length) * 100) : 100,
    delayedPOs: db.purchaseOrders.filter((o) => inScope(o.projectId) && poDelay(o) > 0 && !o.actual).length,
    avgBlockerAge: open.length ? +(open.reduce((s, b) => s + diffDays(b.created, TODAY), 0) / open.length).toFixed(1) : 0,
  };
};
