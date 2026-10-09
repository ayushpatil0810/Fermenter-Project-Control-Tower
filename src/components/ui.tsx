import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Inbox, Info, X } from "lucide-react";
import { cx, initials } from "@/utils";
import { getUser } from "@/services/db";
import { ui, uiStore, useUI } from "@/services/ui";

export type Tone = "ok" | "warn" | "bad" | "eng" | "brand" | "idle";
const TONE: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  eng: "bg-eng-soft text-eng",
  brand: "bg-brand-soft text-brand",
  idle: "bg-idle-soft text-idle",
};
const DOT: Record<Tone, string> = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", eng: "bg-eng", brand: "bg-brand", idle: "bg-idle" };
export const TONE_TEXT: Record<Tone, string> = { ok: "text-ok", warn: "text-warn", bad: "text-bad", eng: "text-eng", brand: "text-brand", idle: "text-idle" };
export const TONE_BG: Record<Tone, string> = DOT;

export const toneFor = (s: string): Tone => {
  if (["On Track", "Good", "Completed", "Delivered", "Received", "Accepted", "Approved", "Resolved", "Issued", "Low"].includes(s)) return s === "Low" ? "idle" : "ok";
  if (["At Risk", "Waiting", "Under Review", "Partially Received", "QC Pending", "Pending Customer", "Investigating", "High", "Medium", "Paused"].includes(s)) return s === "Medium" ? "brand" : "warn";
  if (["Blocked", "Delayed", "Overdue", "Critical", "Rejected", "Escalated"].includes(s)) return "bad";
  if (["In Progress", "Open", "Ordered", "PO Issued", "RFQ", "Requested", "Running"].includes(s)) return "brand";
  return "idle";
};

export function Badge({ children, tone = "idle", dot, className }: { children: ReactNode; tone?: Tone; dot?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-0.5 text-[12px] font-semibold leading-4", TONE[tone], className)}>
      {dot && <span className={cx("size-1.5 rounded-full", DOT[tone])} aria-hidden />}
      {children}
    </span>
  );
}
export const StatusBadge = ({ s, dot = true }: { s: string; dot?: boolean }) => <Badge tone={toneFor(s)} dot={dot}>{s}</Badge>;

export function Progress({ value, tone, className, label = true }: { value: number; tone?: Tone; className?: string; label?: boolean }) {
  const t = tone ?? (value >= 100 ? "ok" : "brand");
  return (
    <div className={cx("flex items-center gap-2", className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className={cx("h-full rounded-full", DOT[t])} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      {label && <span className="tnum w-9 text-right text-[12px] font-semibold text-mute">{value}%</span>}
    </div>
  );
}

export function Btn({
  variant = "secondary",
  size = "md",
  className,
  ...p
}: { variant?: "primary" | "secondary" | "ghost" | "danger" | "success"; size?: "sm" | "md" | "lg" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const v = {
    primary: "bg-brand text-white hover:bg-[#1749a8] border-transparent",
    secondary: "bg-white text-ink border-line hover:bg-paper",
    ghost: "bg-transparent text-mute border-transparent hover:bg-idle-soft hover:text-ink",
    danger: "bg-bad text-white border-transparent hover:bg-[#9d1d1d]",
    success: "bg-ok text-white border-transparent hover:bg-[#0b6638]",
  }[variant];
  const s = { sm: "h-7 px-2.5 text-[13px]", md: "h-9 px-3.5 text-[14px]", lg: "h-12 px-5 text-[16px]" }[size];
  return (
    <button
      type="button"
      {...p}
      className={cx("inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50", v, s, className)}
    />
  );
}

export function Panel({ title, sub, action, children, className, flush }: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={cx("rounded-lg border border-line bg-white", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="min-w-0">
            <h2 className="font-display text-[17px] font-semibold uppercase leading-5 tracking-wide text-ink">{title}</h2>
            {sub && <p className="text-[12px] text-mute">{sub}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, sub, actions, crumb }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; crumb?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {crumb}
        <h1 className="font-display text-[30px] font-semibold uppercase leading-8 tracking-wide text-ink">{title}</h1>
        {sub && <p className="mt-0.5 text-[14px] text-mute">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- form controls ---------- */
const fieldCls = "h-9 w-full rounded-md border border-line bg-white px-2.5 text-[14px] text-ink placeholder:text-[#8591a3] hover:border-[#c4ccd9] focus-visible:border-brand";
export function Field({ label, children, hint, className }: { label: string; children: (id: string) => ReactNode; hint?: string; className?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-mute">
        {label}
      </label>
      {children(id)}
      {hint && <p className="mt-1 text-[12px] text-mute">{hint}</p>}
    </div>
  );
}
export const Input = ({ label, className, ...p }: { label: string } & InputHTMLAttributes<HTMLInputElement>) => (
  <Field label={label} className={className}>{(id) => <input id={id} {...p} className={fieldCls} />}</Field>
);
export const Select = ({ label, options, className, ...p }: { label: string; options: (string | { v: string; l: string })[] } & SelectHTMLAttributes<HTMLSelectElement>) => (
  <Field label={label} className={className}>
    {(id) => (
      <select id={id} {...p} className={fieldCls}>
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.v;
          return <option key={v} value={v}>{typeof o === "string" ? o : o.l}</option>;
        })}
      </select>
    )}
  </Field>
);
export const Textarea = ({ label, className, ...p }: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <Field label={label} className={className}>{(id) => <textarea id={id} rows={3} {...p} className={cx(fieldCls, "h-auto py-2")} />}</Field>
);

export function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: (string | { v: string; l: string })[] }) {
  return (
    <label className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-mute">
      <span className="hidden sm:inline">{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 rounded-md border border-line bg-white px-2 text-[13px] font-medium normal-case tracking-normal text-ink hover:border-[#c4ccd9]">
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.v;
          return <option key={v} value={v}>{typeof o === "string" ? o : o.l}</option>;
        })}
      </select>
    </label>
  );
}

export function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { v: T; l: ReactNode }[]; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md border border-line bg-white p-0.5">
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)} className={cx("h-7 rounded px-2.5 text-[13px] font-semibold", value === o.v ? "bg-nav text-white" : "text-mute hover:text-ink")}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: { v: string; l: string; n?: number }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div role="tablist" className="scroll-thin -mx-1 flex gap-1 overflow-x-auto border-b border-line px-1">
      {tabs.map((t) => (
        <button key={t.v} role="tab" aria-selected={value === t.v} onClick={() => onChange(t.v)} className={cx("-mb-px flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 text-[14px] font-semibold", value === t.v ? "border-brand text-brand" : "border-transparent text-mute hover:text-ink")}>
          {t.l}
          {t.n !== undefined && <span className="rounded bg-idle-soft px-1.5 text-[11px] text-mute">{t.n}</span>}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ id, size = 24, name }: { id?: string; size?: number; name?: string }) {
  const n = name ?? getUser(id)?.name ?? "?";
  return (
    <span aria-hidden style={{ width: size, height: size, fontSize: size * 0.4 }} className="inline-flex shrink-0 items-center justify-center rounded-full bg-nav-2 font-semibold text-white">
      {initials(n)}
    </span>
  );
}
export const Person = ({ id }: { id?: string }) => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
    <Avatar id={id} size={20} />
    <span>{getUser(id)?.name ?? "Unassigned"}</span>
  </span>
);

/* ---------- overlays ---------- */
function useEsc(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const f = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [open, onClose]);
}
export function Drawer({ open, onClose, title, sub, children, footer, width = "max-w-xl" }: { open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }) {
  useEsc(open, onClose);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-nav/50" onClick={onClose} aria-hidden />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Details"} className={cx("slidein relative flex h-full w-full flex-col bg-white shadow-2xl outline-none", width)}>
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-3">
          <div className="min-w-0">
            <h2 className="font-display text-[22px] font-semibold uppercase leading-6 tracking-wide">{title}</h2>
            {sub && <div className="mt-0.5 text-[13px] text-mute">{sub}</div>}
          </div>
          <Btn variant="ghost" size="sm" onClick={onClose} aria-label="Close"><X size={16} /></Btn>
        </header>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-line bg-paper px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}
export function Modal({ open, onClose, title, children, footer, width = "max-w-lg" }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }) {
  useEsc(open, onClose);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-nav/50" onClick={onClose} aria-hidden />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Dialog"} className={cx("fadeup relative flex max-h-[92vh] w-full flex-col rounded-t-xl bg-white shadow-2xl outline-none sm:rounded-xl", width)}>
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-display text-[22px] font-semibold uppercase tracking-wide">{title}</h2>
          <Btn variant="ghost" size="sm" onClick={onClose} aria-label="Close"><X size={16} /></Btn>
        </header>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line bg-paper px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function Toasts() {
  const { toasts } = useUI();
  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-[70] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 md:bottom-4" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="fadeup pointer-events-auto flex items-start gap-2 rounded-lg bg-nav px-3.5 py-3 text-[14px] text-white shadow-xl">
          {t.tone === "ok" ? <CheckCircle2 size={18} className="mt-px shrink-0 text-[#4ade80]" /> : t.tone === "bad" ? <AlertTriangle size={18} className="mt-px shrink-0 text-[#fca5a5]" /> : <Info size={18} className="mt-px shrink-0 text-[#93c5fd]" />}
          <span className="flex-1">{t.text}</span>
          <button aria-label="Dismiss" onClick={() => uiStore.set((s) => ({ ...s, toasts: s.toasts.filter((x) => x.id !== t.id) }))} className="text-white/60 hover:text-white"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

/* ---------- states ---------- */
export const Skeleton = ({ className }: { className?: string }) => <div className={cx("skeleton", className)} aria-hidden />;
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 p-4" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}
    </div>
  );
}
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="space-y-4">
      <Skeleton className="h-9 w-72" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-64 lg:col-span-2" /><Skeleton className="h-64" /></div>
    </div>
  );
}
export function Empty({ title, text, action, icon }: { title: string; text: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok">{icon ?? <Inbox size={22} />}</div>
      <p className="font-display text-[20px] font-semibold uppercase tracking-wide">{title}</p>
      <p className="mt-1 max-w-sm text-[14px] text-mute">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function ErrorState({ text = "Unable to load project updates.", onRetry }: { text?: string; onRetry: () => void }) {
  return (
    <div className="mx-auto mt-16 flex max-w-sm flex-col items-center text-center" role="alert">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-bad-soft text-bad"><AlertTriangle size={22} /></div>
      <p className="font-display text-[22px] font-semibold uppercase tracking-wide">{text}</p>
      <p className="mt-1 text-[14px] text-mute">Check your connection and try once more. Your recent updates are safe.</p>
      <Btn variant="primary" className="mt-4" onClick={onRetry}>Try again</Btn>
    </div>
  );
}
export function Loader({ children, skeleton }: { children: ReactNode; skeleton?: ReactNode }) {
  const [ready, setReady] = useState(false);
  const { simulateError } = useUI();
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 350);
    return () => clearTimeout(t);
  }, []);
  if (simulateError) {
    return <ErrorState onRetry={() => { ui({ simulateError: false }); setReady(false); setTimeout(() => setReady(true), 350); }} />;
  }
  if (!ready) return <>{skeleton ?? <PageSkeleton />}</>;
  return <>{children}</>;
}

/* ---------- KPI ---------- */
export function Kpi({ label, value, sub, tone, onClick, icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; onClick?: () => void; icon?: ReactNode }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-mute">{label}</span>
        {icon && <span className={tone ? TONE_TEXT[tone] : "text-mute"}>{icon}</span>}
      </div>
      <div className={cx("tnum font-display text-[34px] font-semibold leading-9", tone ? TONE_TEXT[tone] : "text-ink")}>{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-mute">{sub}</div>}
    </>
  );
  const cls = cx("relative rounded-lg border border-line bg-white p-3 text-left", tone && "border-t-[3px]", tone === "ok" && "border-t-ok", tone === "warn" && "border-t-warn", tone === "bad" && "border-t-bad", tone === "brand" && "border-t-brand", tone === "eng" && "border-t-eng");
  return onClick ? <button onClick={onClick} className={cx(cls, "transition-shadow hover:shadow-md")}>{body}</button> : <div className={cls}>{body}</div>;
}

/* ---------- table ---------- */
export interface Col<T> {
  key: string;
  header: string;
  render: (r: T) => ReactNode;
  sort?: (r: T) => string | number;
  className?: string;
  align?: "right";
}
export function DataTable<T>({ rows, cols, rowKey, onRow, empty, initialSort, dense, rowClass }: { rows: T[]; cols: Col<T>[]; rowKey: (r: T) => string; onRow?: (r: T) => void; empty?: ReactNode; initialSort?: { key: string; dir: 1 | -1 }; dense?: boolean; rowClass?: (r: T) => string }) {
  const [sort, setSort] = useState(initialSort);
  const sorted = useMemo(() => {
    const c = cols.find((x) => x.key === sort?.key);
    if (!c?.sort || !sort) return rows;
    const f = c.sort;
    return [...rows].sort((a, b) => {
      const x = f(a), y = f(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [rows, sort, cols]);
  if (!rows.length && empty) return <>{empty}</>;
  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="w-full border-collapse text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-line bg-paper">
            {cols.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th key={c.key} scope="col" aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : undefined} className={cx("whitespace-nowrap px-3 py-2 text-[11.5px] font-semibold uppercase tracking-wider text-mute", c.align === "right" && "text-right", c.className)}>
                  {c.sort ? (
                    <button className="inline-flex items-center gap-1 uppercase hover:text-ink" onClick={() => setSort(active && sort!.dir === 1 ? { key: c.key, dir: -1 } : { key: c.key, dir: 1 })}>
                      {c.header}
                      {active ? sort!.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ArrowUpDown size={12} className="opacity-40" />}
                    </button>
                  ) : c.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRow ? () => onRow(r) : undefined}
              onKeyDown={onRow ? (e) => (e.key === "Enter" ? onRow(r) : undefined) : undefined}
              tabIndex={onRow ? 0 : undefined}
              className={cx("border-b border-line last:border-0", onRow && "cursor-pointer hover:bg-[#f7f9fc] focus-visible:bg-brand-soft", rowClass?.(r))}
            >
              {cols.map((c) => (
                <td key={c.key} className={cx("px-3 align-middle", dense ? "py-1.5" : "py-2.5", c.align === "right" && "text-right", c.className)}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const Mono = ({ children, className }: { children: ReactNode; className?: string }) => <span className={cx("font-mono text-[12.5px] font-medium", className)}>{children}</span>;

export function PhotoUpload({ onChange, label = "Upload photo" }: { onChange?: (has: boolean) => void; label?: string }) {
  const [url, setUrl] = useState<string>();
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex h-20 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-[#b4bfd0] bg-paper text-[14px] font-semibold text-mute hover:border-brand hover:text-brand">
        {url ? <img src={url} alt="Selected evidence preview" className="h-full w-full rounded-md object-cover" /> : <>{label} <span className="font-normal">(tap to take or choose)</span></>}
      </label>
      <input
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) { setUrl(URL.createObjectURL(f)); onChange?.(true); }
        }}
      />
    </div>
  );
}
