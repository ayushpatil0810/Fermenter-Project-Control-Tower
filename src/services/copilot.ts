import type { DB, Task, User } from "@/types"
import { users } from "@/data/seed"
import {
  addDays,
  assessHealth,
  effectiveTaskStatus,
  riskScore,
  sevRank,
  TODAY,
} from "@/utils"
import {
  atomicDemoWrite,
  createActivity,
  createBlocker,
  dbStore,
  getDb,
  getUser,
  sessionStore,
  updateBlocker,
  updateProject,
  updateTask,
  updateWorkPackage,
  addComment,
  updatePO,
} from "./db"
import { uiStore } from "./ui"

export const intents = [
  "pending",
  "summary",
  "today",
  "overdue",
  "next",
  "status",
  "risk",
  "blockers",
  "approvals",
  "timeline",
  "dependencies",
  "vendor",
  "activity",
  "complete",
  "assign",
  "resolve",
  "delay",
  "create",
  "comment",
  "open",
  "clarify",
] as const
export type Intent = typeof intents[number]
export interface ParsedIntent {
  intent: Intent
  project: string | null
  record: string | null
  days: number | null
  original: string
}
export interface Context {
  project?: string
  records: {
    id: string
    kind: "task" | "blocker" | "project" | "vendor"
  }[]
}
export interface Proposal {
  intent: "complete" | "assign" | "resolve" | "delay" | "create" | "comment"
  project: string
  record: string
  owner: string
  description: string
  date: string
  original: string
  snapshot: string
  delayDays?: number
  relatedSnapshot?: string
}
export interface ResultCard {
  id: string
  kind: "task" | "blocker" | "project" | "vendor"
  title: string
  meta: string
  reason: string
}
export interface Reply {
  text: string
  cards: ResultCard[]
  proposal?: Proposal
}

// Conservative offline grammar: unrecognized language is never interpreted as a write.
const grammar: [Intent, RegExp][] = [
  ["summary", /(?:today.?s summary|daily summary)/],
  ["open", /\bopen\b/],
  ["assign", /\b(assign|reassign)\b/],
  ["resolve", /\b(resolve|resolved)\b/],
  [
    "delay",
    /(?:report a delay|\bvendor\b.*(?:nahi|delay|late|lagenge)|\b(?:\d+|do|two)\s*(?:din|days?)\b.*(?:delay|late|lagenge))/,
  ],
  [
    "complete",
    /\b(complete|completed|done)\b.*(?:task|welding|inspection|ho gaya)|(?:task|welding|inspection).*\b(complete|completed|done)\b/,
  ],
  ["create", /(?:create|report|raise).*\bblocker\b/],
  ["comment", /(?:add|report|submit).*(?:update|comment|progress)/],
  ["next", /(?:what should|next|priorities|attention)/],
  ["overdue", /\boverdue\b/],
  ["approvals", /\bapproval/],
  ["dependencies", /(?:dependenc|delivery affect|delay.*delivery|impact)/],
  ["timeline", /\btimeline\b/],
  ["activity", /\bactivity\b/],
  ["risk", /(?:at.?risk|risk explanation)/],
  ["blockers", /\b(blocked|blocker|blocking)\b/],
  ["vendor", /\bvendors?\b/],
  ["today", /(?:\btoday\b|\baaj\b)/],
  ["pending", /(?:pending|my tasks)/],
  ["status", /(?:status|ka haal)/],
]
export function validateParsed(value: unknown): ParsedIntent {
  if (!value || typeof value !== "object")
    throw new Error("Invalid structured intent.")
  const p = value as ParsedIntent
  if (
    !intents.includes(p.intent) ||
    typeof p.original !== "string" ||
    p.original.length > 1000 ||
    !(p.project === null || typeof p.project === "string") ||
    !(p.record === null || typeof p.record === "string") ||
    !(
      p.days === null ||
      (Number.isInteger(p.days) && p.days > 0 && p.days <= 365)
    )
  )
    throw new Error("Malformed structured intent.")
  return p
}
export function parseIntent(message: string): ParsedIntent {
  const original = message.trim()
  if (!original || original.length > 1000)
    throw new Error("Enter a message of 1–1,000 characters.")
  const days = original.match(/\b(\d+|do|two)\s*(?:din|days?)\b/i)
  return validateParsed({
    intent:
      grammar.find(([, rule]) => rule.test(original.toLowerCase()))?.[0] ??
      "clarify",
    project: original.match(/\bFER-\d+\b/i)?.[0].toUpperCase() ?? null,
    record:
      original.match(/\b(?:T-\d+|BLK-\d+|WP-[\w-]+)\b/i)?.[0].toUpperCase() ??
      null,
    days: days ? (/^(do|two)$/i.test(days[1]) ? 2 : Number(days[1])) : null,
    original,
  })
}
export function visibleProject(db: DB, user: User, id: string): boolean {
  const p = db.projects.find((x) => x.id === id)
  if (!p) return false
  if (user.role === "Owner") return true
  if (user.role === "Project Manager") return p.pm === user.id
  if (user.role === "Vendor")
    return db.workPackages.some(
      (w) => w.projectId === id && w.vendorId === user.vendorId,
    )
  return (
    db.tasks.some((t) => t.projectId === id && t.owner === user.id) ||
    db.blockers.some((b) => b.projectId === id && b.owner === user.id) ||
    (user.role === "Installation" &&
      db.siteJobs.some((j) => j.projectId === id))
  )
}
function actor(): User {
  const s = sessionStore.get(),
    u = getUser(s?.userId)
  if (!s || !u || s.role !== u.role)
    throw new Error("Sign in with a valid demo session.")
  return u
}
export function canWrite(db: DB, u: User, project: string, owner?: string) {
  return (
    visibleProject(db, u, project) &&
    u.role !== "Vendor" &&
    (u.role === "Owner" || u.role === "Project Manager" || owner === u.id)
  )
}
export function rankTasks(db: DB, tasks: Task[]) {
  const score = (t: Task) => {
    const critical = db.blockers.some(
      (b) =>
        b.projectId === t.projectId &&
        b.status !== "Resolved" &&
        b.severity === "Critical",
    )
    const dependency = db.tasks.find((d) => d.id === t.dependency)
    return (
      (critical ? 1000 : 0) +
      (t.due < TODAY ? 500 : t.due === TODAY ? 300 : 0) +
      (dependency?.status === "Completed" || !t.dependency ? 100 : 0) +
      (3 - sevRank[t.priority]) * 10
    )
  }
  return [...tasks].sort(
    (a, b) =>
      score(b) - score(a) ||
      a.due.localeCompare(b.due) ||
      a.id.localeCompare(b.id),
  )
}
export function answer(message: string, context: Context): Reply {
  const parsed = parseIntent(message),
    db = dbStore.get(),
    u = actor()
  const scope = db.projects.filter((p) => visibleProject(db, u, p.id))
  const personalOrPortfolio = ["pending", "overdue", "today", "next", "risk", "summary"].includes(parsed.intent)
  const project = parsed.project ?? (personalOrPortfolio && !/\b(this project|ye project)\b/i.test(message) ? undefined : context.project)
  if (project && !scope.some((p) => p.id === project))
    throw new Error("Project not found in your authorized demo scope.")
  const referenceKind = /\bblocker\b/i.test(message)
    ? "blocker"
    : /\btask\b/i.test(message)
      ? "task"
      : undefined
  const references = context.records.filter(
    (r) => !referenceKind || r.kind === referenceKind,
  )
  const reference =
    parsed.record ??
    (/\b(first|it|this|that|ye|previous)\b/i.test(message) &&
    (/\bfirst\b/i.test(message) || references.length === 1)
      ? references[0]?.id
      : undefined)
  const tasks = db.tasks.filter(
    (t) =>
      scope.some((p) => p.id === t.projectId) &&
      (!project || t.projectId === project),
  )
  const mine = tasks.filter((t) => t.owner === u.id && t.status !== "Completed")
  const blockers = db.blockers.filter(
    (b) =>
      scope.some((p) => p.id === b.projectId) &&
      (!project || b.projectId === project) &&
      b.status !== "Resolved",
  )
  const taskCard = (t: Task): ResultCard => ({
    id: t.id,
    kind: "task",
    title: t.name,
    meta: `${t.projectId} · ${getUser(t.owner)?.name} · ${effectiveTaskStatus(t)} · ${t.priority} · Due ${t.due}`,
    reason: `${
      t.due < TODAY ? "Overdue. " : t.due === TODAY ? "Due today. " : ""
    }${
      t.dependency
        ? `Recorded dependency: ${t.dependency} (${db.tasks.find((d) => d.id === t.dependency)?.status ?? "unknown"}).`
        : "No task dependency recorded."
    }${
      db.blockers.some(
        (b) =>
          b.projectId === t.projectId &&
          b.status !== "Resolved" &&
          b.severity === "Critical",
      )
        ? " Critical project blocker needs review before proceeding."
        : ""
    }`,
  })
  const blockerCard = (b: DB["blockers"][number]): ResultCard => ({
    id: b.id,
    kind: "blocker",
    title: b.title,
    meta: `${b.projectId} · ${b.severity} · ${b.status} · ${getUser(b.owner)?.name} · Due ${b.due}`,
    reason: `${b.description} Reported schedule impact: ${b.scheduleImpact}d. ${b.impact} ${b.resolution ?? ""}`,
  })
  const pCards = scope
    .filter((p) => !project || p.id === project)
    .map((p) => ({
      id: p.id,
      kind: "project" as const,
      title: `${p.id} — ${p.equipment}`,
      meta: `${p.stage} · ${p.progress}% · Stored: ${p.health} · Delivery ${p.delivery}`,
      reason: `Calculated: ${assessHealth(db, p).health}. ${assessHealth(db, p).reason} PM: ${getUser(p.pm)?.name}. ${db.tasks.filter((t) => t.projectId === p.id && t.status !== "Completed").length} pending tasks. ${db.blockers
        .filter((b) => b.projectId === p.id && b.status !== "Resolved")
        .map(
          (b) =>
            `${b.id}: ${b.title} (${b.scheduleImpact}d reported; ${getUser(b.owner)?.name}).`,
        )
        .join(" ")} Next: ${
        assessHealth(db, p).health === "On Track"
          ? "Review the next due task."
          : "Confirm the blocker owner's next commitment."
      } Final delivery impact unconfirmed.`,
    }))
  const writes = ["complete", "assign", "resolve", "delay", "create", "comment"]
  if (writes.includes(parsed.intent)) {
    let record = reference
    if (!record && parsed.intent === "complete") {
      const words = message
        .toLowerCase()
        .match(/\b(welding|inspection|drawing|assembly)\b/)
      const matches = words
        ? tasks.filter((t) => t.name.toLowerCase().includes(words[0]))
        : []
      if (matches.length === 1) record = matches[0].id
      else
        return {
          text: "Select the exact task; I will not complete an arbitrary match.",
          cards: matches.length ? matches.map(taskCard) : tasks.map(taskCard),
        }
    }
    if (!record && parsed.intent === "delay" && project) {
      const matches = db.workPackages.filter(
        (w) => w.projectId === project && w.status !== "Delivered",
      )
      const componentWords =
        message
          .toLowerCase()
          .match(/\b(shaft|flange|sheet|jacket|impeller|gearbox)\b/g) ?? []
      const componentMatches = componentWords.length
        ? matches.filter(
            (w) =>
              componentWords.every((word) =>
                w.title.toLowerCase().includes(word),
              ) && !/alternate quote/i.test(w.title),
          )
        : matches
      if (componentMatches.length === 1) record = componentMatches[0].id
    }
    const entity =
      db.tasks.find((t) => t.id === record) ??
      db.blockers.find((b) => b.id === record) ??
      db.workPackages.find((w) => w.id === record)
    const pid = entity?.projectId ?? project
    if (!pid)
      return {
        text: `Please select a project first.${
          parsed.days
            ? ` Reported additional delay: ${parsed.days} days; vendor and component are not confirmed.`
            : ""
        }`,
        cards: pCards,
      }
    if (
      !canWrite(
        db,
        u,
        pid,
        entity && "owner" in entity
          ? entity.owner
          : parsed.intent === "delay" && u.role === "Procurement"
            ? u.id
            : undefined,
      )
    )
      throw new Error("You are not authorized to change this record.")
    if (["assign", "resolve"].includes(parsed.intent) && !entity)
      return {
        text: "Select an exact task or blocker, then repeat your request.",
        cards: [...tasks.map(taskCard), ...blockers.map(blockerCard)],
      }
    if (
      parsed.intent === "delay" &&
      (!entity || !("committed" in entity) || !parsed.days)
    )
      return {
        text: "Which component/work package is delayed, and by how many days? Select it below, then report the delay. No data has changed.",
        cards: db.workPackages
          .filter((w) => w.projectId === pid)
          .map((w) => ({
            id: w.id,
            kind: "vendor",
            title: w.title,
            meta: `${w.projectId} · ${db.vendors.find((v) => v.id === w.vendorId)?.name}`,
            reason: `Committed ${w.committed}; forecast ${w.forecast}.`,
          })),
      }
    return {
      text: "Review the proposed change. Nothing is saved until you confirm. Delivery impact is unconfirmed.",
      cards: [],
      proposal: {
        intent: parsed.intent as Proposal["intent"],
        project: pid,
        record: record ?? "",
        owner: /procurement/i.test(message)
          ? users.find((x) => x.role === "Procurement")!.id
          : entity && "owner" in entity
            ? entity.owner
            : u.id,
        description: message,
        date:
          entity && "forecast" in entity && entity.forecast && parsed.days
            ? addDays(entity.forecast, parsed.days)
            : TODAY,
        original: message,
        snapshot: JSON.stringify(
          entity ?? db.projects.find((p) => p.id === pid),
        ),
        delayDays: parsed.days ?? undefined,
        relatedSnapshot:
          parsed.intent === "delay" && entity && "vendorId" in entity
            ? JSON.stringify(
                db.blockers.filter(
                  (b) =>
                    b.projectId === pid &&
                    b.vendorId === entity.vendorId &&
                    b.status !== "Resolved",
                ),
              )
            : undefined,
      },
    }
  }
  switch (parsed.intent) {
    case "summary": {
      const overdueMilestones = db.milestones.filter(
        (m) =>
          scope.some((p) => p.id === m.projectId) &&
          m.pct < 100 &&
          m.planned < TODAY,
      )
      const approvalCount = db.documents.filter(
        (d) =>
          scope.some((p) => p.id === d.projectId) &&
          ["Pending Customer", "Under Review"].includes(d.status),
      ).length
      const roleCards =
        u.role === "Procurement" || u.role === "Vendor"
          ? answer("Vendor status", { records: [] }).cards.filter((c) =>
              db.workPackages.some(
                (w) =>
                  w.id === c.id &&
                  w.status !== "Delivered" &&
                  (w.forecast <= TODAY || w.status === "Delayed"),
              ),
            )
          : u.role === "Shop Floor" ||
              u.role === "Design Engineer" ||
              u.role === "Installation"
            ? rankTasks(db, mine).slice(0, 5).map(taskCard)
            : pCards.filter(
                (c) =>
                  assessHealth(db, scope.find((p) => p.id === c.id)!).health !==
                  "On Track",
              )
      const site =
        u.role === "Installation"
          ? db.siteJobs
              .filter((j) => scope.some((p) => p.id === j.projectId))
              .map((j) => `${j.projectId} site activity ${j.date}`)
              .join("; ")
          : ""
      const deliveries = scope
        .filter((p) => p.delivery >= TODAY && p.delivery <= addDays(TODAY, 7))
        .map((p) => `${p.id} due ${p.delivery}`)
        .join("; ")
      const ready = mine.filter(
        (t) =>
          t.status === "Not Started" &&
          (!t.dependency ||
            db.tasks.find((d) => d.id === t.dependency)?.status ===
              "Completed"),
      ).length
      const delayedMaterials = db.purchaseOrders.filter(
        (o) =>
          scope.some((p) => p.id === o.projectId) &&
          !o.actual &&
          (o.status === "Delayed" || o.expected < TODAY),
      ).length
      return {
        text: `${u.role} summary · ${TODAY}: ${mine.filter((t) => t.due < TODAY).length} personal overdue tasks; ${blockers.filter((b) => b.severity === "Critical").length} critical blockers; ${overdueMilestones.length} overdue milestones; ${approvalCount} pending document approvals. ${
          u.role === "Procurement"
            ? `${delayedMaterials} delayed material records.`
            : `${ready} personal tasks ready to start.`
        } ${site} Upcoming delivery commitments: ${deliveries || "none in the next 7 days"}. Review the exceptions below; delivery impact is unconfirmed.`,
        cards: [
          ...roleCards,
          ...blockers
            .filter((b) =>
              u.role === "Owner" || u.role === "Project Manager"
                ? b.severity === "Critical"
                : b.owner === u.id,
            )
            .slice(0, 3)
            .map(blockerCard),
        ],
      }
    }
    case "open": {
      const found = context.records.find((r) => r.id === reference)
      return {
        text: found ? "Use Open record below." : "Select a result first.",
        cards: found
          ? [
              ...tasks.map(taskCard),
              ...blockers.map(blockerCard),
              ...pCards,
            ].filter((c) => c.id === found.id)
          : [],
      }
    }
    case "pending":
    case "overdue":
    case "today":
    case "next": {
      const list = rankTasks(
        db,
        mine.filter((t) =>
          parsed.intent === "overdue"
            ? t.due < TODAY
            : parsed.intent === "today"
              ? t.due <= TODAY
              : true,
        ),
      )
      return {
        text: `${list.length} personal ${
          parsed.intent === "next"
            ? "priorities, ranked by critical blockers, overdue/date urgency, dependency readiness and recorded priority"
            : "pending tasks"
        }. Demo date: ${TODAY}. Recommendations are not guaranteed optimal; critical-path and buffer data are unavailable.`,
        cards:
          parsed.intent === "next"
            ? [
                ...blockers
                  .filter(
                    (b) =>
                      b.severity === "Critical" &&
                      (b.owner === u.id ||
                        u.role === "Owner" ||
                        u.role === "Project Manager"),
                  )
                  .map(blockerCard),
                ...list.slice(0, 5).map(taskCard),
              ]
            : list.map(taskCard),
      }
    }
    case "status":
    case "risk":
      return {
        text: "Stored project status and existing system-calculated health. Delivery forecasts are not changed by this conversation.",
        cards:
          parsed.intent === "risk"
            ? pCards.filter(
                (c) =>
                  assessHealth(db, scope.find((p) => p.id === c.id)!).health !==
                  "On Track",
              )
            : pCards,
      }
    case "blockers":
      return {
        text: "Recorded open blockers. Review owner and reported impact; final delivery impact is not confirmed.",
        cards: blockers.map(blockerCard),
      }
    case "dependencies":
      return {
        text: "Recorded task dependencies below. Schedule buffer and parallel-work feasibility are not modeled; a component delay cannot be added automatically to customer delivery.",
        cards: tasks.filter((t) => t.dependency).map(taskCard),
      }
    case "timeline":
      return {
        text:
          db.milestones
            .filter(
              (m) =>
                scope.some((p) => p.id === m.projectId) &&
                (!project || m.projectId === project),
            )
            .map(
              (m) =>
                `${m.projectId} · ${m.name}: planned ${m.planned}, forecast ${m.forecast}, ${m.pct}%`,
            )
            .join("\n") || "No milestones recorded.",
        cards: [],
      }
    case "approvals":
      return {
        text:
          db.documents
            .filter(
              (d) =>
                scope.some((p) => p.id === d.projectId) &&
                (!project || d.projectId === project) &&
                ["Under Review", "Pending Customer"].includes(d.status),
            )
            .map(
              (d) =>
                `${d.projectId} · ${d.filename} · ${d.status}. Approval authority is not modeled.`,
            )
            .join("\n") || "No pending document approvals in your scope.",
        cards: [],
      }
    case "vendor":
      return {
        text: "Recorded vendor commitments; no live integration.",
        cards: db.workPackages
          .filter(
            (w) =>
              scope.some((p) => p.id === w.projectId) &&
              (!project || w.projectId === project) &&
              (!/\bdelayed\b/i.test(message) || w.status === "Delayed") &&
              (u.role !== "Vendor" || w.vendorId === u.vendorId),
          )
          .map((w) => ({
            id: w.id,
            kind: "vendor",
            title: w.title,
            meta: `${w.projectId} · ${w.status}`,
            reason: `Committed ${w.committed}; forecast ${w.forecast}.`,
          })),
      }
    case "activity":
      return {
        text:
          db.activities
            .filter(
              (a) =>
                a.projectId &&
                scope.some((p) => p.id === a.projectId) &&
                (!project || a.projectId === project),
            )
            .slice(0, 10)
            .map((a) => `${a.ts} · ${a.action}: ${a.description}`)
            .join("\n") || "No recorded activity.",
        cards: [],
      }
    default:
      return {
        text: "Offline assistant: try a suggested prompt, select a project, or use an exact task/blocker ID. Unsupported or ambiguous requests are not executed.",
        cards: [],
      }
  }
}

export function execute(
  p: Proposal,
): {
  ok: boolean
  message: string
} {
  try {
    const db = dbStore.get(),
      u = actor()
    const entity =
      db.tasks.find((t) => t.id === p.record) ??
      db.blockers.find((b) => b.id === p.record) ??
      db.workPackages.find((w) => w.id === p.record)
    if (
      !canWrite(
        db,
        u,
        p.project,
        entity && "owner" in entity
          ? entity.owner
          : p.intent === "delay" && u.role === "Procurement"
            ? u.id
            : undefined,
      )
    )
      throw new Error("Not authorized.")
    if (entity && entity.projectId !== p.project)
      throw new Error("Record/project mismatch.")
    if (
      JSON.stringify(entity ?? db.projects.find((x) => x.id === p.project)) !==
      p.snapshot
    )
      throw new Error("Record changed. Request a fresh proposal.")
    if (
      !p.description.trim() ||
      p.description.length > 1000 ||
      !intents.includes(p.intent)
    )
      throw new Error("Invalid update details.")
    if (!getUser(p.owner) || getUser(p.owner)?.role === "Vendor")
      throw new Error("Select an internal owner.")
    if (uiStore.get().simulateError)
      throw new Error(
        "Simulated persistence failure. Disable it in Settings and retry.",
      )
    atomicDemoWrite(() => {
      if (p.intent === "complete") {
        const t = db.tasks.find((x) => x.id === p.record)
        if (!t) throw new Error("Task not found.")
        if (
          t.dependency &&
          db.tasks.find((x) => x.id === t.dependency)?.status !== "Completed"
        )
          throw new Error("Recorded dependency is incomplete or unknown.")
        updateTask(t.id, { status: "Completed" })
      } else if (p.intent === "assign") {
        if (!["Owner", "Project Manager"].includes(u.role))
          throw new Error(
            "Only Owner or scoped Project Manager can reassign work.",
          )
        if (db.tasks.some((x) => x.id === p.record))
          updateTask(p.record, { owner: p.owner })
        else if (db.blockers.some((x) => x.id === p.record))
          updateBlocker(p.record, { owner: p.owner })
        else throw new Error("Select a task or blocker.")
      } else if (p.intent === "resolve") {
        if (!db.blockers.some((x) => x.id === p.record))
          throw new Error("Blocker not found.")
        updateBlocker(p.record, {
          status: "Resolved",
          resolution: p.description,
        })
      } else if (p.intent === "delay") {
        if (!["Owner", "Project Manager", "Procurement"].includes(u.role))
          throw new Error(
            "Procurement or project leadership must approve delivery updates.",
          )
        const work = db.workPackages.find((x) => x.id === p.record)
        if (!work) throw new Error("Work package not found.")
        if (work.status === "Delivered")
          throw new Error(
            "A delivered work package cannot be reported delayed.",
          )
        if (
          !Number.isInteger(p.delayDays) ||
          !p.delayDays ||
          p.delayDays < 1 ||
          p.delayDays > 365
        )
          throw new Error("Confirm a reported delay of 1–365 days.")
        const linked = db.blockers.filter(
          (b) =>
            b.projectId === work.projectId &&
            b.vendorId === work.vendorId &&
            b.status !== "Resolved",
        )
        if (JSON.stringify(linked) !== p.relatedSnapshot)
          throw new Error("Related blocker changed. Request a fresh proposal.")
        const words = work.title
          .toLowerCase()
          .split(/\W+/)
          .filter((w) => w.length > 3)
        const matches = linked.filter((b) =>
          words.some((w) => b.title.toLowerCase().includes(w)),
        )
        if (matches.length > 1)
          throw new Error(
            "Multiple related blockers match. Review the issue in the blocker module.",
          )
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
          Number.isNaN(Date.parse(p.date)) ||
          new Date(p.date).toISOString().slice(0, 10) !== p.date
        )
          throw new Error("Enter a valid ISO date.")
        updateWorkPackage(
          p.record,
          { forecast: p.date, status: "Delayed" },
          p.description,
        )
        if (matches.length === 1) {
          updateBlocker(matches[0].id, {
            forecast: p.date,
            description: `${matches[0].description}\nReported update: ${p.description}`,
            scheduleImpact: matches[0].scheduleImpact + p.delayDays,
            impact: `Employee reported ${p.delayDays} additional days. Final customer delivery impact unconfirmed.`,
          })
          addComment(
            matches[0].id,
            `Copilot: ${p.description} Reported additional delay: ${p.delayDays}d.`,
          )
        } else {
          createBlocker({
            projectId: p.project,
            vendorId: work.vendorId,
            title: `${work.title} delayed`,
            description: p.description,
            category: "Vendor",
            severity: "High",
            owner: p.owner,
            forecast: p.date,
            scheduleImpact: p.delayDays,
            impact:
              "Employee-reported component delay; customer delivery impact unconfirmed.",
          })
        }
        db.purchaseOrders
          .filter(
            (o) =>
              o.projectId === work.projectId &&
              o.vendorId === work.vendorId &&
              words.some((w) => o.item.toLowerCase().includes(w)) &&
              !o.actual,
          )
          .forEach((o) =>
            updatePO(
              o.id,
              { expected: p.date, status: "Delayed" },
              "Copilot confirmed vendor delay.",
            ),
          )
      } else if (p.intent === "create") {
        if (
          db.blockers.some(
            (b) =>
              b.projectId === p.project &&
              b.status !== "Resolved" &&
              b.description.trim().toLowerCase() ===
                p.description.trim().toLowerCase(),
          )
        )
          throw new Error(
            "An identical open blocker already exists. Open it instead.",
          )
        createBlocker({
          projectId: p.project,
          title: p.description.slice(0, 100),
          description: p.description,
          category: "Engineering",
          severity: "Medium",
          owner: p.owner,
        })
      } else if (p.intent === "comment")
        addComment(p.record || p.project, p.description)
      else throw new Error("Unsupported operation.")
      createActivity({
        projectId: p.project,
        action: `Copilot: ${p.intent}`,
        description: `Source: offline Copilot. Record: ${p.record || p.project}. Previous: ${p.snapshot}. Approved: ${JSON.stringify({ owner: p.owner, date: p.date, description: p.description })}. Original: ${p.original}`,
        kind: "update",
      })
      const latest = getDb(),
        project = latest.projects.find((x) => x.id === p.project)!
      const health = assessHealth(latest, project)
      updateProject(project.id, {
        health: health.health,
        healthReason: health.reason,
      })
    })
    return {
      ok: true,
      message:
        "Saved to this browser's demo data. Shared modules and activity feed are refreshed.",
    }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Update failed. Nothing confirmed.",
    }
  }
}
