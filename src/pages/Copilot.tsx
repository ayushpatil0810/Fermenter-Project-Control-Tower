import { useEffect, useRef, useState } from "react"
import { Bot, Check, RotateCcw, Send, X } from "lucide-react"
import { Badge, Btn, Input, Panel, Select, Textarea } from "@/components/ui"
import { getUser, useDb, useSession } from "@/services/db"
import { navigate, openCopilot, ui, useRoute, useUI } from "@/services/ui"
import {
  answer,
  canWrite,
  execute,
  parseIntent,
  visibleProject,
  type Context,
  type Proposal,
  type Reply,
  type ResultCard,
} from "@/services/copilot"
import { users } from "@/data/seed"
import { TODAY } from "@/utils"

const quickActions = [
  { label: "My Tasks", prompt: "My tasks" },
  { label: "What Should I Do Next?", prompt: "What should I do next?" },
  { label: "At-Risk Projects", prompt: "Which projects are at risk?" },
  { label: "Report a Delay", prompt: "Report a delay" },
  { label: "Project Status", prompt: "Project status" },
  { label: "Today's Summary", prompt: "Today's summary" },
]
interface Message {
  user: string
  reply: Reply
  error?: boolean
}

// One mounted workspace in Shell: minimization and route changes retain the conversation.
export default function Copilot() {
  const db = useDb(),
    session = useSession()!,
    user = getUser(session.userId)!,
    state = useUI(),
    route = useRoute()
  const projects = db.projects.filter((p) => visibleProject(db, user, p.id))
  const [context, setContext] = useState<Context>({ records: [] })
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const bottom = useRef<HTMLDivElement>(null),
    panel = useRef<HTMLDivElement>(null),
    launcher = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const covered = !!(
    state.blockerId ||
    state.taskId ||
    state.newTask ||
    state.newBlocker ||
    state.quick ||
    state.search ||
    state.notif ||
    state.menu ||
    state.report
  )
  const close = () => {
    ui({ copilot: false })
    previousFocus.current?.focus()
  }
  const send = async (value: string, selected = context) => {
    if (busy || !value.trim()) return
    setText("")
    setBusy(true)
    await new Promise((r) => setTimeout(r, 120))
    try {
      const reply = answer(value, selected)
      setMessages((m) => [...m, { user: value, reply }])
      setContext((c) => ({
        ...selected,
        project:
          parseIntent(value).project ??
          reply.proposal?.project ??
          selected.project,
        records: reply.cards.length
          ? reply.cards.map(({ id, kind }) => ({ id, kind }))
          : c.records,
      }))
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          user: value,
          reply: {
            text: e instanceof Error ? e.message : "Request failed.",
            cards: [],
          },
          error: true,
        },
      ])
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    const request = state.copilotRequest
    if (!request) return
    const next: Context = { project: request.project, records: [] }
    setContext(next)
    if (request.prompt) void send(request.prompt, next)
  }, [state.copilotRequest?.token])
  useEffect(() => {
    if (route.page === "copilot") openCopilot(route.id)
  }, [route.page, route.id])
  useEffect(() => {
    if (state.copilot && !covered) {
      previousFocus.current = (document.activeElement as HTMLElement)
      panel.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus()
    }
  }, [state.copilot, covered])
  useEffect(() => {
    if (state.copilot) bottom.current?.scrollIntoView({ block: "nearest" })
  }, [messages, busy, state.copilot])
  const select = (card: ResultCard) => {
    const project =
      db.tasks.find((t) => t.id === card.id)?.projectId ??
      db.blockers.find((b) => b.id === card.id)?.projectId ??
      db.workPackages.find((w) => w.id === card.id)?.projectId ??
      card.id
    setContext({ project, records: [{ id: card.id, kind: card.kind }] })
  }
  const open = (card: ResultCard) => {
    select(card)
    if (card.kind === "task") ui({ taskId: card.id })
    else if (card.kind === "blocker") ui({ blockerId: card.id })
    else if (card.kind === "vendor") {
      const work = db.workPackages.find((w) => w.id === card.id)
      if (work) navigate(`vendor/${work.vendorId}`)
    } else navigate(`project/${card.id}`)
  }
  return (
    <>
      <div
        ref={launcher}
        className="copilot-launcher"
        hidden={state.copilot || covered}
      >
        <Btn
          className="copilot-launch-button"
          variant="primary"
          aria-label="Open Fermenter Copilot"
          aria-expanded={state.copilot}
          aria-controls="fermenter-copilot"
          title="Ask about tasks, projects and blockers"
          onClick={() => {
            previousFocus.current = (document.activeElement as HTMLElement)
            ui({ copilot: true })
          }}
        >
          <Bot size={24} />
          <span className="hidden sm:inline">Fermenter Copilot</span>
        </Btn>
      </div>
      <div
        ref={panel}
        id="fermenter-copilot"
        role="dialog"
        aria-label="Fermenter Copilot — Your manufacturing operations assistant"
        className="copilot-window"
        hidden={!state.copilot || covered}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation()
            close()
          }
          if (e.key === "Tab") {
            const controls = Array.from(
              panel.current?.querySelectorAll<HTMLElement>(
                "button:not(:disabled), textarea, select, input",
              ) ?? [],
            )
            const first = controls[0],
              last = controls.at(-1)
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault()
              last?.focus()
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault()
              first?.focus()
            }
          }
        }}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-line bg-nav-2 p-3 text-white">
          <span className="rounded-lg bg-brand p-2">
            <Bot size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-xl font-semibold">
              Fermenter Copilot
            </div>
            <div className="text-xs text-white/70">
              Your manufacturing operations assistant
            </div>
          </div>
          <Btn
            variant="ghost"
            size="sm"
            className="!text-white"
            aria-label="New conversation"
            title="New conversation"
            disabled={busy}
            onClick={() => {
              setMessages([])
              setText("")
              setContext({ records: [] })
            }}
          >
            <RotateCcw size={16} />
          </Btn>
          <Btn
            variant="ghost"
            size="sm"
            className="!text-white"
            aria-label="Minimize Fermenter Copilot"
            onClick={close}
          >
            <X size={18} />
          </Btn>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-warn-soft px-3 py-2">
          <Badge tone="warn">Demo Mode · offline parser</Badge>
          <span className="text-xs text-mute">{TODAY}</span>
        </div>
        <div className="shrink-0 border-b border-line px-3 py-2">
          <Select
            label={`Context · ${user.name}`}
            value={context.project ?? ""}
            options={[
              { v: "", l: "All my authorized projects" },
              ...projects.map((p) => ({
                v: p.id,
                l: `${p.id} · ${p.customer}`,
              })),
            ]}
            onChange={(e) =>
              setContext({ project: e.target.value || undefined, records: [] })
            }
          />
          {context.records[0] && (
            <div className="mt-1 text-xs text-brand">
              Selected: {context.records[0].id}
            </div>
          )}
        </div>
        <div
          role="log"
          aria-live="polite"
          aria-label="Copilot conversation"
          className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3"
        >
          {!messages.length && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-brand-soft p-3 text-sm leading-relaxed">
                Hi! I'm Fermenter Copilot. I can help you track projects, find
                pending work, resolve blockers and decide what to do next.
              </div>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((q) => (
                  <Btn
                    key={q.label}
                    className="!h-auto !whitespace-normal py-2 text-left"
                    size="sm"
                    disabled={busy}
                    onClick={() => send(q.prompt)}
                  >
                    {q.label}
                  </Btn>
                ))}
              </div>
              <div className="text-xs text-mute">
                Shared illustrative records · changes saved in this browser
                only. No live AI or external integrations.
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className="space-y-2">
              <div className="ml-auto w-fit max-w-full break-words rounded-lg bg-nav-2 px-3 py-2 text-sm text-white">
                {m.user}
              </div>
              <div
                className={`whitespace-pre-wrap text-sm leading-relaxed ${
                  m.error ? "text-bad" : "text-ink"
                }`}
              >
                {m.reply.text}
              </div>
              {m.error && (
                <Btn size="sm" disabled={busy} onClick={() => send(m.user)}>
                  Retry request
                </Btn>
              )}
              {m.reply.cards.map((card) => (
                <Result
                  key={card.id}
                  card={card}
                  onOpen={() => open(card)}
                  onSelect={() => select(card)}
                  onProject={() => {
                    select(card)
                    const pid =
                      db.tasks.find((t) => t.id === card.id)?.projectId ??
                      db.blockers.find((b) => b.id === card.id)?.projectId ??
                      db.workPackages.find((w) => w.id === card.id)
                        ?.projectId ??
                      card.id
                    navigate(`project/${pid}`)
                  }}
                  complete={(() => {
                    const t = db.tasks.find((t) => t.id === card.id)
                    return t &&
                      t.status !== "Completed" &&
                      canWrite(db, user, t.projectId, t.owner)
                      ? () =>
                          send(`${t.projectId} ${t.id} task complete kar do`)
                      : undefined
                  })()}
                  busy={busy}
                />
              ))}
              {m.reply.proposal && (
                <Confirmation
                  initial={m.reply.proposal}
                  onSaved={(msg) =>
                    setMessages((v) => [
                      ...v,
                      {
                        user: "Confirmed update",
                        reply: { text: msg, cards: [] },
                      },
                    ])
                  }
                />
              )}
            </div>
          ))}
          {busy && (
            <div role="status" className="animate-pulse text-sm text-mute">
              Checking authorized demo records…
            </div>
          )}
          <div ref={bottom} />
        </div>
        <form
          className="copilot-composer shrink-0 border-t border-line bg-white p-3"
          onSubmit={(e) => {
            e.preventDefault()
            send(text)
          }}
        >
          <Textarea
            label="Message Copilot"
            rows={2}
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            placeholder="FER-24026 ka status batao…"
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault()
                send(text)
              }
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-mute">
              English + Hinglish · review before save
            </span>
            <Btn
              type="submit"
              variant="primary"
              size="sm"
              disabled={busy || !text.trim()}
            >
              <Send size={14} />
              Send
            </Btn>
          </div>
        </form>
      </div>
    </>
  )
}
function Result({
  card,
  onOpen,
  onSelect,
  onProject,
  complete,
  busy,
}: {
  card: ResultCard
  onOpen: () => void
  onSelect: () => void
  onProject: () => void
  complete?: () => void
  busy: boolean
}) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-paper p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-brand">
        {card.kind} · {card.id}
      </div>
      <div className="mt-1 font-semibold">{card.title}</div>
      <div className="mt-1 text-xs text-mute">{card.meta}</div>
      <div className="mt-2 text-sm">{card.reason}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn size="sm" onClick={onOpen}>
          {card.kind === "task"
            ? "Open Task"
            : card.kind === "project"
              ? "View Project"
              : "Open record"}
        </Btn>
        {card.kind !== "project" && (
          <Btn size="sm" onClick={onProject}>
            View Project
          </Btn>
        )}
        <Btn size="sm" onClick={onSelect}>
          Select
        </Btn>
        {complete && (
          <Btn size="sm" disabled={busy} onClick={complete}>
            Mark Complete
          </Btn>
        )}
      </div>
    </div>
  )
}
function Confirmation({
  initial,
  onSaved,
}: {
  initial: Proposal
  onSaved: (msg: string) => void
}) {
  const db = useDb()
  const work = db.workPackages.find((w) => w.id === initial.record)
  const [p, setP] = useState(initial),
    [state, setState] = useState<"review" | "saving" | "saved" | "cancelled">(
      "review",
    ),
    [error, setError] = useState("")
  const save = () => {
    setState("saving")
    setError("")
    const result = execute(p)
    if (result.ok) {
      setState("saved")
      onSaved(result.message)
    } else {
      setState("review")
      setError(result.message)
    }
  }
  if (state === "cancelled")
    return <Badge>Proposal cancelled · no changes saved</Badge>
  if (state === "saved")
    return (
      <Badge tone="ok">
        <Check size={14} />
        Confirmed and saved
      </Badge>
    )
  return (
    <Panel
      title={`Confirm ${p.intent}`}
      sub={`${p.project} · ${
        work
          ? `${work.title} · ${db.vendors.find((v) => v.id === work.vendorId)?.name}`
          : p.record || "New update"
      } · No automatic customer delivery change`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Responsible owner"
          value={p.owner}
          options={users
            .filter((u) => u.role !== "Vendor")
            .map((u) => ({ v: u.id, l: `${u.name} · ${u.role}` }))}
          onChange={(e) => setP({ ...p, owner: e.target.value })}
        />
        {p.intent === "delay" && (
          <>
            <Input
              label="Vendor forecast (verify component above)"
              type="date"
              value={p.date}
              onChange={(e) => setP({ ...p, date: e.target.value })}
            />
            <Input
              label="Reported additional delay (days)"
              type="number"
              min={1}
              max={365}
              value={p.delayDays ?? ""}
              onChange={(e) =>
                setP({ ...p, delayDays: Number(e.target.value) })
              }
            />
          </>
        )}
        <Textarea
          className="sm:col-span-2"
          label="Edit details / resolution"
          value={p.description}
          maxLength={1000}
          onChange={(e) => setP({ ...p, description: e.target.value })}
        />
        {error && (
          <div role="alert" className="text-bad sm:col-span-2">
            {error} No changes saved.
          </div>
        )}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Btn variant="primary" disabled={state === "saving"} onClick={save}>
            {error ? "Retry save" : "Confirm and save"}
          </Btn>
          <Btn
            disabled={state === "saving"}
            onClick={() => setState("cancelled")}
          >
            Cancel
          </Btn>
        </div>
      </div>
    </Panel>
  )
}
