import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { users, COMPANY } from "@/data/seed";
import { login } from "@/services/db";
import { ROLES, type Role } from "@/types";
import { Logo } from "@/layouts/Shell";
import { Badge, Btn, Input, Select } from "@/components/ui";

const DEMOS: { email: string; role: Role }[] = [
  { email: "owner@punebiofab.demo", role: "Owner" },
  { email: "pm@punebiofab.demo", role: "Project Manager" },
  { email: "procurement@punebiofab.demo", role: "Procurement" },
  { email: "shopfloor@punebiofab.demo", role: "Shop Floor" },
  { email: "field@punebiofab.demo", role: "Installation" },
  { email: "vendor@precisionmachine.demo", role: "Vendor" },
];

export default function Login() {
  const [email, setEmail] = useState("pm@punebiofab.demo");
  const [pw, setPw] = useState("demo1234");
  const [role, setRole] = useState<Role>("Project Manager");
  const pick = (e: string, r: Role) => { setEmail(e); setRole(r); };
  return (
    <div className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      <section className="relative flex flex-col justify-between overflow-hidden bg-nav p-6 text-white sm:p-10">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "36px 36px" }} />
        <div className="relative"><Logo dark /></div>
        <div className="relative my-10 max-w-xl">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-[#7ea6ff]">Operational control tower</p>
          <h1 className="font-display text-[44px] font-semibold uppercase leading-[1.02] tracking-wide sm:text-[60px]">From scattered updates to one live view of every project.</h1>
          <p className="mt-4 max-w-lg text-[17px] text-[#b6c4da]">Track engineering, procurement, fabrication, vendors and installation from one operational control tower.</p>
          <div className="mt-8 grid max-w-md grid-cols-3 gap-px overflow-hidden rounded-lg bg-white/10 text-center">
            {[["8", "active projects"], ["12", "regular vendors"], ["3", "install teams"]].map(([n, l]) => (
              <div key={l} className="bg-nav-2 px-3 py-3"><p className="font-display text-[30px] font-semibold leading-8">{n}</p><p className="text-[12px] text-[#8da2c0]">{l}</p></div>
            ))}
          </div>
        </div>
        <p className="relative text-[13px] text-[#8da2c0]">{COMPANY.name} · {COMPANY.location}</p>
      </section>
      <section className="flex items-center justify-center bg-white p-6 sm:p-10">
        <form className="w-full max-w-sm space-y-4" onSubmit={(e) => { e.preventDefault(); login(email, role); window.location.hash = "#/dashboard"; }}>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[30px] font-semibold uppercase tracking-wide">Sign in</h2>
            <Badge tone="warn" className="uppercase tracking-wider">Demo mode</Badge>
          </div>
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          <Input label="Password" type="password" required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
          <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)} options={ROLES} />
          <Btn variant="primary" size="lg" type="submit" className="w-full">Enter control tower <ArrowRight size={17} /></Btn>
          <p className="text-[12.5px] text-mute">Any password works in demo mode. Choose a demo account:</p>
          <div className="flex flex-wrap gap-1.5">
            {DEMOS.map((d) => (
              <button key={d.email} type="button" onClick={() => pick(d.email, d.role)} className="rounded-md border border-line px-2 py-1 text-[12.5px] font-medium hover:border-brand hover:bg-brand-soft">
                {d.role}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-mute">{users.length} demo users · dummy data only</p>
        </form>
      </section>
    </div>
  );
}
