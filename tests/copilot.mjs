import assert from "node:assert/strict"
import { build } from "vite"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

const dir = await mkdtemp(path.join(tmpdir(), "fermenter-copilot-"))
const storage = new Map()
let failStorage = false
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => {
    if (failStorage) throw new Error("Storage unavailable")
    storage.set(key, value)
  },
  removeItem: (key) => storage.delete(key),
}
try {
  await build({
    configFile: false,
    resolve: { alias: { "@": path.resolve("src") } },
    build: {
      ssr: "tests/copilot-entry.ts",
      outDir: dir,
      minify: false,
      rollupOptions: { external: [], output: { entryFileNames: "entry.mjs" } },
    },
    ssr: { noExternal: true },
    logLevel: "silent",
  })
  const c = await import(pathToFileURL(path.join(dir, "entry.mjs")).href)
  const context = { records: [] }
  c.login("owner@punebiofab.demo", "Owner")
  assert.equal(c.parseIntent("Aaj kya pending hai?").intent, "today")
  assert.equal(c.parseIntent("FER-24026 ka status batao").project, "FER-24026")
  assert.equal(
    c.parseIntent("Vendor se abhi aaya nahi, 2 din aur lagenge.").days,
    2,
  )
  assert.equal(c.parseIntent("Welding complete ho gaya.").intent, "complete")
  assert.throws(() => c.validateParsed({ intent: "destroy" }))
  assert.throws(() => c.parseIntent("x".repeat(1001)))
  assert.throws(() => c.answer("FER-99999 ka status batao", context))
  assert.equal(
    c.answer("Vendor se abhi aaya nahi, 2 din aur lagenge.", context).proposal,
    undefined,
  )
  assert.ok(c.answer("FER-24026 ka status batao", context).cards.length)
  const db = c.dbStore.get()
  const task = db.tasks.find((t) => t.status !== "Completed" && !t.dependency)
  assert.ok(task)
  let proposal = c.answer(`${task.id} task complete kar do`, context).proposal
  assert.ok(proposal)
  failStorage = true
  let result = c.execute(proposal)
  assert.equal(result.ok, false)
  assert.equal(
    c.dbStore.get(),
    db,
    "failed persistence must publish no changes",
  )
  failStorage = false
  result = c.execute(proposal)
  assert.equal(result.ok, true)
  assert.equal(
    c.dbStore.get().tasks.find((t) => t.id === task.id).status,
    "Completed",
  )
  assert.ok(
    c.dbStore.get().activities.some((a) => a.action === "Copilot: complete"),
  )
  assert.equal(
    JSON.parse(storage.get("pbf-demo-db-v2")).tasks.find(
      (t) => t.id === task.id,
    ).status,
    "Completed",
  )
  assert.equal(
    c.execute(proposal).ok,
    false,
    "stale/repeated confirmation rejected",
  )
  c.login("vendor@precisionmachine.demo", "Vendor")
  assert.equal(c.execute(proposal).ok, false, "vendor write rejected")
  c.login("owner@punebiofab.demo", "Owner")
  const reply = c.answer("Show my overdue tasks", context)
  assert.ok(
    reply.cards.every(
      (card) =>
        c.dbStore.get().tasks.find((t) => t.id === card.id).owner === "u-owner",
    ),
  )
  const ready = c.dbStore
    .get()
    .tasks.filter((t) => t.status !== "Completed")
    .slice(0, 3)
  assert.deepEqual(
    c.rankTasks(c.dbStore.get(), ready).map((t) => t.id),
    c.rankTasks(c.dbStore.get(), ready).map((t) => t.id),
  )
  c.resetDemoData()
  assert.equal(
    c.parseIntent(
      "FER-24026 ka agitator shaft vendor se abhi tak nahi aaya. Do din aur lagenge.",
    ).days,
    2,
  )
  assert.equal(c.parseIntent("Mere next tasks kya hain?").intent, "next")
  assert.equal(c.parseIntent("Show all delayed vendors").intent, "vendor")
  assert.equal(c.parseIntent("Today's summary").intent, "summary")
  c.login("procurement@punebiofab.demo", "Procurement")
  const personal = c.answer("My tasks", context).cards
  assert.ok(personal.length)
  assert.ok(
    personal.every(
      (card) =>
        c.dbStore.get().tasks.find((t) => t.id === card.id)?.owner === "u-sj",
    ),
  )
  assert.ok(
    c.answer("Today's summary", context).text.includes("Procurement summary"),
  )
  const forecast = c.dbStore
    .get()
    .workPackages.find((w) => w.id === "WP-101").forecast
  const blockerCount = c.dbStore.get().blockers.length
  const delay = c.answer(
    "FER-24026 ka agitator shaft vendor se nahi aaya. Do din aur lagenge.",
    context,
  ).proposal
  assert.equal(
    delay.record,
    "WP-101",
    "component must uniquely match actual vendor, not alternate quote",
  )
  assert.equal(delay.delayDays, 2)
  const unchanged = c.dbStore.get()
  failStorage = true
  assert.equal(c.execute(delay).ok, false)
  assert.equal(
    c.dbStore.get(),
    unchanged,
    "linked delay writes roll back together",
  )
  failStorage = false
  assert.equal(c.execute(delay).ok, true)
  const updated = c.dbStore.get()
  assert.notEqual(
    updated.workPackages.find((w) => w.id === "WP-101").forecast,
    forecast,
  )
  assert.equal(
    updated.blockers.length,
    blockerCount,
    "existing shaft blocker updated without duplicates",
  )
  const shaft = updated.blockers.find((b) => b.id === "BLK-026")
  assert.equal(
    shaft.scheduleImpact,
    unchanged.blockers.find((b) => b.id === "BLK-026").scheduleImpact + 2,
  )
  assert.equal(
    shaft.forecast,
    updated.workPackages.find((w) => w.id === "WP-101").forecast,
  )
  assert.equal(
    updated.purchaseOrders.find((o) => o.id === "PO-2631").expected,
    shaft.forecast,
  )
  assert.equal(
    updated.projects.find((p) => p.id === "FER-24026").health,
    "Blocked",
  )
  assert.ok(
    updated.comments.some(
      (comment) =>
        comment.entityId === "BLK-026" && comment.text.includes("Copilot"),
    ),
  )
  assert.ok(c.getDashboardMetrics().criticalBlockers > 0)
  assert.equal(c.execute(delay).ok, false)
  c.login("pm@punebiofab.demo", "Project Manager")
  const overdue = c.answer("Show my overdue tasks", context)
  const followContext = {
    records: overdue.cards.map(({ id, kind }) => ({ id, kind })),
  }
  if (overdue.cards.length) {
    assert.equal(
      c.answer("Open the first one", followContext).cards[0].id,
      overdue.cards[0].id,
    )
    const assign = c.answer(
      "Assign the first task to procurement",
      followContext,
    ).proposal
    assert.equal(assign.record, overdue.cards[0].id)
    assert.equal(c.execute(assign).ok, true)
  }
  for (const [email, role] of [
    ["owner@punebiofab.demo", "Owner"],
    ["shopfloor@punebiofab.demo", "Shop Floor"],
    ["field@punebiofab.demo", "Installation"],
    ["design@punebiofab.demo", "Design Engineer"],
    ["vendor@precisionmachine.demo", "Vendor"],
  ]) {
    c.login(email, role)
    assert.ok(
      c.answer("Today's summary", context).text.includes(`${role} summary`),
    )
    assert.ok(c.answer("What should I do next?", context).text)
  }
  c.resetDemoData()
  assert.equal(
    c.dbStore.get().workPackages.find((w) => w.id === "WP-101").forecast,
    forecast,
  )
  console.log(
    "Passed: parsing and Hinglish, invalid references, clarification, confirmed writes, atomic rollback, shared-data synchronization, linked delay/blocker/PO updates without duplicates, health/dashboard refresh, audit, stale confirmations, role summaries, personal scope, contextual assignment, deterministic ranking, and demo reset.",
  )
} finally {
  await rm(dir, { recursive: true, force: true })
}
