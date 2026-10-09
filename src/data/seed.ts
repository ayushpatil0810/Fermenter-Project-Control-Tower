import type {
  Activity,
  Blocker,
  DB,
  DocumentRec,
  Milestone,
  Project,
  ProjectStage,
  PurchaseOrder,
  StageName,
  Task,
  User,
  Vendor,
  VendorWorkPackage,
} from "@/types";
import { STAGES } from "@/types";
import { addDays, diffDays } from "@/utils";

export const COMPANY = {
  name: "Pune BioFab Engineering Pvt. Ltd.",
  location: "Bhosari, Pune, Maharashtra",
  business: "Custom stainless-steel fermenters, bioreactors and process equipment",
  employees: 85,
  facilities: 1,
  offices: 2,
  vendors: 12,
  installTeams: 3,
};

export const users: User[] = [
  { id: "u-owner", name: "Anil Deshpande", title: "Managing Director", role: "Owner", email: "owner@punebiofab.demo" },
  { id: "u-rk", name: "Rajesh Kulkarni", title: "Project Manager", role: "Project Manager", email: "pm@punebiofab.demo" },
  { id: "u-pd", name: "Priya Deshmukh", title: "Project Manager", role: "Project Manager", email: "priya@punebiofab.demo" },
  { id: "u-ap", name: "Amit Patil", title: "Project Manager", role: "Project Manager", email: "amit@punebiofab.demo" },
  { id: "u-ma", name: "Meera Apte", title: "Design Engineer", role: "Design Engineer", email: "design@punebiofab.demo" },
  { id: "u-vk", name: "Vikram Kale", title: "Design Engineer", role: "Design Engineer", email: "vikram@punebiofab.demo" },
  { id: "u-sj", name: "Suresh Joshi", title: "Procurement Officer", role: "Procurement", email: "procurement@punebiofab.demo" },
  { id: "u-ss", name: "Santosh Shinde", title: "Shop-Floor Supervisor", role: "Shop Floor", email: "shopfloor@punebiofab.demo" },
  { id: "u-nm", name: "Nitin More", title: "QC Engineer", role: "Shop Floor", email: "qc@punebiofab.demo" },
  { id: "u-it", name: "Irfan Tamboli", title: "Installation Lead", role: "Installation", email: "field@punebiofab.demo" },
  {
    id: "u-vp",
    name: "Prakash Gaikwad",
    title: "Vendor — Precision Machine Works",
    role: "Vendor",
    email: "vendor@precisionmachine.demo",
    vendorId: "v-pmw",
  },
];

export const DEFAULT_USER: Record<string, string> = {
  Owner: "u-owner",
  "Project Manager": "u-rk",
  "Design Engineer": "u-ma",
  Procurement: "u-sj",
  "Shop Floor": "u-ss",
  Installation: "u-it",
  Vendor: "u-vp",
};

const D = (s: string) => `2026-${s}`;

interface P0 {
  id: string;
  customer: string;
  cap: number;
  type: "Fermenter" | "Bioreactor";
  pm: string;
  stage: StageName;
  stagePct: number;
  progress: number;
  health: Project["health"];
  reason: string;
  value: number;
  start: string;
  delivery: string;
  city: string;
  material: string;
  auto: string;
  risk?: string;
}
const P0s: P0[] = [
  { id: "FER-24017", customer: "BioProcess Solutions Pvt. Ltd.", cap: 3000, type: "Fermenter", pm: "u-rk", stage: "Fabrication", stagePct: 70, progress: 68, health: "On Track", reason: "Shell fabrication progressing; weld inspection pending.", value: 2150000, start: D("06-15"), delivery: D("10-18"), city: "Hyderabad", material: "SS316L", auto: "Semi-automatic (PLC)" },
  { id: "FER-24021", customer: "PharmaGen Biotech Ltd.", cap: 5000, type: "Bioreactor", pm: "u-pd", stage: "Procurement", stagePct: 60, progress: 42, health: "At Risk", reason: "Drawing approval pending for 3 days.", value: 3480000, start: D("07-20"), delivery: D("11-02"), city: "Ahmedabad", material: "SS316L", auto: "Fully automated (SCADA)", risk: "Customer drawing approval delayed." },
  { id: "FER-24024", customer: "NutraFerment Foods Pvt. Ltd.", cap: 2000, type: "Fermenter", pm: "u-ap", stage: "Installation", stagePct: 60, progress: 81, health: "On Track", reason: "Vessel delivered; anchor correction in progress at site.", value: 1675000, start: D("05-10"), delivery: D("10-12"), city: "Pune", material: "SS304", auto: "Manual with instrumentation", risk: "Foundation anchor alignment requires correction." },
  { id: "FER-24026", customer: "BioSyn Research Labs", cap: 10000, type: "Bioreactor", pm: "u-rk", stage: "Engineering", stagePct: 55, progress: 25, health: "Blocked", reason: "Critical vendor blocker: agitator shaft machining delayed.", value: 5840000, start: D("08-24"), delivery: D("11-25"), city: "Bengaluru", material: "SS316L", auto: "Fully automated (SCADA)", risk: "Agitator shaft machining delayed by external vendor." },
  { id: "FER-24028", customer: "EnzymeTech Industries", cap: 1500, type: "Fermenter", pm: "u-ap", stage: "Fabrication", stagePct: 55, progress: 54, health: "On Track", reason: "Fabrication on plan; heat-treatment slot being rebooked.", value: 1320000, start: D("07-01"), delivery: D("10-29"), city: "Vadodara", material: "SS316L", auto: "Semi-automatic (PLC)" },
  { id: "FER-24031", customer: "BioCatalyst Manufacturing Ltd.", cap: 7500, type: "Bioreactor", pm: "u-pd", stage: "Engineering", stagePct: 65, progress: 31, health: "On Track", reason: "Design on schedule; jacket thermal review due today.", value: 4650000, start: D("08-10"), delivery: D("12-15"), city: "Chennai", material: "SS316L", auto: "Fully automated (SCADA)" },
  { id: "FER-24033", customer: "AgriBio Solutions", cap: 1000, type: "Fermenter", pm: "u-ap", stage: "Procurement", stagePct: 50, progress: 48, health: "At Risk", reason: "SS316L sheet delivery delayed by 4 days.", value: 980000, start: D("08-20"), delivery: D("11-20"), city: "Nashik", material: "SS316L", auto: "Manual with instrumentation", risk: "SS316L sheet delivery delayed." },
  { id: "FER-24035", customer: "Precision Pharma Systems", cap: 3500, type: "Fermenter", pm: "u-rk", stage: "FAT / Inspection", stagePct: 80, progress: 92, health: "On Track", reason: "Hydro test passed; FAT scheduled for 09 Oct.", value: 2760000, start: D("06-01"), delivery: D("10-14"), city: "Hyderabad", material: "SS316L", auto: "Semi-automatic (PLC)" },
];

export const projects: Project[] = P0s.map((p) => ({
  id: p.id,
  customer: p.customer,
  equipment: `${p.cap.toLocaleString("en-IN")} L ${p.type === "Bioreactor" ? (p.auto.startsWith("Fully") ? "Automated Bioreactor" : "Bioreactor") : "Stainless Steel Fermenter"}`,
  type: p.type,
  capacity: p.cap,
  material: p.material,
  automation: p.auto,
  pm: p.pm,
  stage: p.stage,
  stagePct: p.stagePct,
  progress: p.progress,
  health: p.health,
  healthReason: p.reason,
  value: p.value,
  start: p.start,
  delivery: p.delivery,
  siteCity: p.city,
  currentRisk: p.risk,
}));
projects[0].equipment = "3,000 L Stainless Steel Fermenter";
projects[3].equipment = "10,000 L Bioreactor";
projects[4].equipment = "1,500 L Fermenter";
projects[5].equipment = "7,500 L Bioreactor";
projects[6].equipment = "1,000 L Fermenter";
projects[7].equipment = "3,500 L Fermenter";
projects[2].equipment = "2,000 L Fermenter";

const STAGE_OWNER: Record<StageName, (pm: string) => string> = {
  "Customer Requirement": (pm) => pm,
  Engineering: () => "u-ma",
  "Drawing Approval": (pm) => pm,
  Procurement: () => "u-sj",
  Fabrication: () => "u-ss",
  Assembly: () => "u-ss",
  "FAT / Inspection": () => "u-nm",
  Dispatch: () => "u-ss",
  Installation: () => "u-it",
  Commissioning: () => "u-it",
  Handover: (pm) => pm,
};

export const stages: ProjectStage[] = projects.flatMap((p) => {
  const cur = STAGES.indexOf(p.stage);
  const span = diffDays(p.start, p.delivery);
  return STAGES.map((name, i) => {
    const planned = i <= 7 ? addDays(p.start, Math.round(((i + 1) * span) / 8)) : addDays(p.delivery, (i - 7) * 8);
    let status: ProjectStage["status"] = i < cur ? "Completed" : i === cur ? "In Progress" : "Upcoming";
    let pct = i < cur ? 100 : i === cur ? p.stagePct : 0;
    if (p.id === "FER-24021" && name === "Drawing Approval") {
      status = "Waiting";
      pct = 80;
    }
    if (p.id === "FER-24026" && i === cur) status = "Blocked";
    return {
      projectId: p.id,
      name,
      status,
      pct,
      planned,
      actual: status === "Completed" ? addDays(planned, (i % 3) - 1) : undefined,
      owner: STAGE_OWNER[name](p.pm),
    };
  });
});

type MT = [number, string, string];
const MS_NAMES = ["Design Freeze", "Material Procurement", "Shell Fabrication", "Agitator Assembly", "Hydro Test", "FAT", "Dispatch", "Installation"];
const MS: Record<string, MT[]> = {
  "FER-24017": [[100, "07-20", "07-20"], [100, "08-25", "08-27"], [80, "10-06", "10-10"], [30, "10-11", "10-14"], [0, "10-14", "10-15"], [0, "10-16", "10-16"], [0, "10-18", "10-18"], [0, "10-30", "10-30"]],
  "FER-24021": [[100, "08-25", "08-28"], [40, "10-05", "10-08"], [0, "10-12", "10-15"], [0, "10-19", "10-22"], [0, "10-23", "10-26"], [0, "10-27", "10-29"], [0, "11-02", "11-02"], [0, "11-15", "11-15"]],
  "FER-24024": [[100, "06-30", "06-30"], [100, "07-25", "07-25"], [100, "08-30", "08-30"], [100, "09-10", "09-10"], [100, "09-15", "09-15"], [100, "09-25", "09-25"], [100, "10-02", "10-02"], [60, "10-12", "10-14"]],
  "FER-24026": [[60, "10-12", "10-16"], [10, "10-25", "10-28"], [0, "11-02", "11-05"], [0, "11-08", "11-14"], [0, "11-14", "11-17"], [0, "11-18", "11-20"], [0, "11-25", "11-25"], [0, "12-10", "12-10"]],
  "FER-24028": [[100, "08-05", "08-05"], [100, "09-10", "09-12"], [70, "10-09", "10-09"], [0, "10-14", "10-14"], [0, "10-18", "10-18"], [0, "10-22", "10-22"], [0, "10-29", "10-29"], [0, "11-12", "11-12"]],
  "FER-24031": [[70, "10-15", "10-15"], [0, "11-02", "11-02"], [0, "11-15", "11-15"], [0, "11-25", "11-25"], [0, "12-01", "12-01"], [0, "12-05", "12-05"], [0, "12-15", "12-15"], [0, "12-28", "12-28"]],
  "FER-24033": [[100, "09-20", "09-21"], [55, "10-06", "10-10"], [0, "10-20", "10-24"], [0, "10-30", "11-03"], [0, "11-06", "11-09"], [0, "11-12", "11-14"], [0, "11-20", "11-20"], [0, "12-05", "12-05"]],
  "FER-24035": [[100, "07-10", "07-10"], [100, "08-15", "08-14"], [100, "09-10", "09-10"], [100, "09-22", "09-24"], [100, "10-02", "10-03"], [80, "10-09", "10-09"], [0, "10-14", "10-14"], [0, "10-28", "10-28"]],
};
export const milestones: Milestone[] = Object.entries(MS).flatMap(([pid, arr]) =>
  arr.map(([pct, pl, fc], i) => ({
    id: `M-${pid.slice(-2)}-${i + 1}`,
    projectId: pid,
    name: MS_NAMES[i],
    planned: D(pl),
    forecast: D(fc),
    actual: pct === 100 ? D(fc) : undefined,
    pct,
  })),
);

type TT = [string, string, string, string, string, Task["priority"], Task["status"], string, string, string | undefined, number, number, string];
const T: TT[] = [
  ["T-101", "Shell longitudinal welding", "FER-24017", "Fabrication", "u-ss", "High", "In Progress", "10-01", "10-08", undefined, 40, 31, "Visual inspection pending after weld completion."],
  ["T-102", "Internal polishing — shell", "FER-24017", "Finishing", "u-ss", "Medium", "Not Started", "10-08", "10-10", "T-101", 24, 0, "Ra ≤ 0.5 µm required on product-contact surfaces."],
  ["T-103", "Follow up customer GA drawing approval", "FER-24021", "Engineering", "u-pd", "High", "Waiting", "10-01", "10-06", undefined, 6, 5, "Customer reviewer on leave; escalated to plant head."],
  ["T-104", "Confirm mechanical seal PO with supplier", "FER-24021", "Procurement", "u-sj", "Medium", "In Progress", "10-04", "10-08", undefined, 4, 3, "Double mechanical seal, SiC/SiC faces."],
  ["T-105", "Obtain revised agitator shaft forecast", "FER-24026", "Procurement", "u-sj", "Critical", "Blocked", "10-01", "10-08", undefined, 8, 6, "Vendor revised commitment to 10 Oct; awaiting written confirmation."],
  ["T-106", "Release agitator assembly drawing", "FER-24026", "Engineering", "u-ma", "High", "In Progress", "09-25", "10-07", "T-121", 30, 26, "Held for shaft tolerance confirmation."],
  ["T-107", "Anchor bolt re-alignment at site", "FER-24024", "Installation", "u-it", "High", "In Progress", "10-07", "10-08", undefined, 12, 7, "Two bolts ~12 mm off; customer civil team engaged."],
  ["T-108", "Vessel placement on skid", "FER-24024", "Installation", "u-it", "High", "Not Started", "10-09", "10-10", "T-107", 10, 0, "Crane booked for 10 Oct."],
  ["T-109", "Nozzle fabrication", "FER-24028", "Fabrication", "u-ss", "Medium", "In Progress", "10-03", "10-09", undefined, 32, 24, "8 of 11 nozzles welded."],
  ["T-110", "Expedite SS316L 8 mm sheet", "FER-24033", "Procurement", "u-sj", "High", "Waiting", "09-28", "10-05", undefined, 6, 7, "Supplier mill rolling slipped."],
  ["T-111", "FAT procedure customer sign-off", "FER-24035", "Quality", "u-nm", "High", "In Progress", "10-06", "10-08", undefined, 8, 5, "Customer QA reviewing protocol."],
  ["T-112", "Support frame fabrication", "FER-24031", "Fabrication", "u-ss", "Medium", "Not Started", "10-08", "10-12", undefined, 36, 0, "Frame drawing Rev B."],
  ["T-113", "Jacket thermal design review", "FER-24031", "Engineering", "u-vk", "Medium", "In Progress", "10-02", "10-08", undefined, 20, 16, "Review with process consultant today."],
  ["T-114", "Issue P&ID Rev C", "FER-24031", "Engineering", "u-vk", "Low", "Completed", "09-20", "10-02", undefined, 14, 15, "Issued to customer."],
  ["T-115", "Hydro test preparation", "FER-24035", "Quality", "u-nm", "Medium", "Completed", "09-28", "10-02", undefined, 10, 9, "Passed at 4.5 bar."],
  ["T-116", "Book heat-treatment slot", "FER-24028", "Procurement", "u-sj", "Medium", "Waiting", "10-01", "10-04", undefined, 3, 3, "HeatTreat Pune full till 12 Oct."],
  ["T-117", "Packing crate design", "FER-24035", "Logistics", "u-ss", "Low", "Not Started", "10-10", "10-13", undefined, 6, 0, "Sea-worthy not required; road transport."],
  ["T-118", "Instrument loop check", "FER-24024", "Installation", "u-it", "Medium", "Not Started", "10-10", "10-11", "T-108", 8, 0, "PT100, level probe, pressure transmitter."],
  ["T-119", "Prepare dispatch plan", "FER-24017", "Logistics", "u-rk", "Medium", "Not Started", "10-12", "10-16", undefined, 4, 0, "Trailer booking via transporter."],
  ["T-120", "Verify material test certificates", "FER-24033", "Quality", "u-nm", "High", "In Progress", "10-07", "10-08", undefined, 5, 3, "Heat numbers to be matched to MTC."],
  ["T-121", "Freeze shaft tolerance with vendor", "FER-24026", "Engineering", "u-ma", "High", "Completed", "09-30", "10-04", undefined, 6, 6, "h6 fit confirmed."],
  ["T-122", "Customer URS freeze", "FER-24026", "Engineering", "u-rk", "High", "Completed", "08-24", "09-10", undefined, 24, 28, "Signed URS v3."],
  ["T-123", "Weld procedure qualification (WPS/PQR)", "FER-24028", "Quality", "u-nm", "Medium", "Completed", "09-12", "09-20", undefined, 12, 12, "Qualified for SS316L."],
  ["T-124", "Release final BOM", "FER-24021", "Engineering", "u-vk", "Medium", "Completed", "09-10", "09-25", undefined, 16, 18, "BOM Rev B released."],
  ["T-125", "Check alternate machining capacity", "FER-24026", "Procurement", "u-sj", "High", "In Progress", "10-07", "10-09", undefined, 5, 2, "Shivneri Engineering quoted 7-day turnaround."],
  ["T-126", "Review assembly sequence for shaft slip", "FER-24026", "Planning", "u-rk", "Medium", "Not Started", "10-08", "10-10", "T-125", 4, 0, "Evaluate building vessel internals first."],
  ["T-127", "Site survey for FER-24017 installation", "FER-24017", "Installation", "u-it", "Low", "Not Started", "10-09", "10-14", undefined, 6, 0, "Check utility tie-in points."],
];
export const tasks: Task[] = T.map(([id, name, projectId, workstream, owner, priority, status, s, d, dep, est, act, notes]) => ({
  id,
  name,
  projectId,
  workstream,
  owner,
  priority,
  status,
  start: D(s),
  due: D(d),
  dependency: dep,
  estHours: est,
  actHours: act,
  notes,
  attachments: [],
}));

const bl = (b: Partial<Blocker> & Pick<Blocker, "id" | "projectId" | "title" | "category" | "severity" | "owner" | "status" | "created" | "due" | "description" | "impact">): Blocker => ({
  costImpact: 0,
  scheduleImpact: 0,
  attachments: [],
  actions: [],
  ...b,
});
export const blockers: Blocker[] = [
  bl({
    id: "BLK-026",
    projectId: "FER-24026",
    title: "Agitator shaft machining delayed",
    category: "Vendor",
    severity: "Critical",
    owner: "u-sj",
    vendorId: "v-pmw",
    status: "Investigating",
    created: D("10-06"),
    due: D("10-08"),
    forecast: D("10-10"),
    scheduleImpact: 2,
    costImpact: 180000,
    description:
      "Vendor has reported that the required alloy steel raw material arrived late. Machining cannot be completed by the original committed date.",
    impact: "Assembly delayed by 2 days; downstream hydro test at risk.",
    attachments: ["PMW_delay_notice.pdf", "Shaft_drawing_RevC.pdf"],
    actions: [
      { label: "Escalate vendor", done: false },
      { label: "Check alternate machining capacity", done: true },
      { label: "Review assembly sequence", done: false },
      { label: "Inform project manager", done: true },
    ],
  }),
  bl({
    id: "BLK-021",
    projectId: "FER-24021",
    title: "Drawing approval pending from customer",
    category: "Customer",
    severity: "High",
    owner: "u-pd",
    status: "Waiting",
    created: D("10-05"),
    due: D("10-09"),
    forecast: D("10-11"),
    scheduleImpact: 3,
    costImpact: 95000,
    description: "GA drawing Rev C submitted on 03 Oct. Customer technical team has not responded; procurement of jacket plates is on hold.",
    impact: "Procurement of long-lead items cannot be released; delivery at risk.",
    attachments: ["GA_Rev_C_transmittal.pdf"],
    actions: [
      { label: "Call customer plant head", done: true },
      { label: "Send reminder with approval deadline", done: false },
    ],
  }),
  bl({
    id: "BLK-024",
    projectId: "FER-24024",
    title: "Foundation anchor alignment incorrect",
    category: "Installation",
    severity: "High",
    owner: "u-it",
    status: "Open",
    created: D("10-07"),
    due: D("10-10"),
    forecast: D("10-10"),
    scheduleImpact: 2,
    costImpact: 45000,
    description: "Two anchor bolts are approximately 12 mm out of alignment with the vessel base plate.",
    impact: "Vessel placement on 10 Oct cannot proceed until corrected.",
    attachments: ["anchor_photo_1.jpg", "anchor_photo_2.jpg"],
    actions: [
      { label: "Customer civil team to re-grout bolts", done: false },
      { label: "Re-measure base plate", done: true },
    ],
  }),
  bl({
    id: "BLK-033",
    projectId: "FER-24033",
    title: "SS316L sheet delivery delayed",
    category: "Material",
    severity: "High",
    owner: "u-sj",
    vendorId: "v-ssc",
    status: "Escalated",
    created: D("10-03"),
    due: D("10-06"),
    forecast: D("10-10"),
    scheduleImpact: 4,
    costImpact: 60000,
    description: "SS Components India reports mill rolling slipped; 8 mm SS316L sheets will dispatch on 10 Oct.",
    impact: "Shell cutting start slips by 4 days.",
    actions: [
      { label: "Escalate to supplier director", done: true },
      { label: "Explore ex-stock alternative", done: false },
    ],
  }),
  bl({
    id: "BLK-028",
    projectId: "FER-24028",
    title: "Heat-treatment slot unavailable until 12 Oct",
    category: "Procurement",
    severity: "Medium",
    owner: "u-sj",
    vendorId: "v-htp",
    status: "Waiting",
    created: D("10-04"),
    due: D("10-12"),
    forecast: D("10-12"),
    scheduleImpact: 1,
    costImpact: 15000,
    description: "Stress-relief furnace fully booked; slot confirmed for 12 Oct.",
    impact: "Minor float consumption; no delivery impact yet.",
  }),
  bl({
    id: "BLK-035",
    projectId: "FER-24035",
    title: "Weld inspection record missing for nozzle N4",
    category: "Documentation",
    severity: "Medium",
    owner: "u-nm",
    status: "Investigating",
    created: D("10-07"),
    due: D("10-09"),
    scheduleImpact: 1,
    costImpact: 10000,
    description: "Radiography record for nozzle N4 weld not found in the weld file; required for FAT dossier.",
    impact: "FAT report cannot be closed without record.",
  }),
  bl({
    id: "BLK-017",
    projectId: "FER-24017",
    title: "Sheet thickness mismatch on shell plate",
    category: "Material",
    severity: "High",
    owner: "u-nm",
    status: "Resolved",
    created: D("09-18"),
    due: D("09-22"),
    scheduleImpact: 0,
    costImpact: 0,
    description: "Delivered sheet measured 5.8 mm vs 6 mm ordered.",
    impact: "Resolved with supplier replacement.",
    resolution: "Supplier replaced plates at no cost; MTC re-verified.",
  }),
  bl({
    id: "BLK-031",
    projectId: "FER-24031",
    title: "Customer process data missing for jacket design",
    category: "Engineering",
    severity: "Medium",
    owner: "u-pd",
    status: "Resolved",
    created: D("09-22"),
    due: D("09-28"),
    description: "Heat load data for the jacket was not provided.",
    impact: "Resolved; design proceeds.",
    resolution: "Customer shared heat-load sheet on 27 Sep.",
  }),
];

export const vendors: Vendor[] = [
  { id: "v-pmw", name: "Precision Machine Works", location: "Chakan", services: "CNC machining, shafts, flanges", contact: "Prakash Gaikwad", phone: "+91 98220 41107", email: "vendor@precisionmachine.demo", onTime: 82, health: "At Risk", activeJobs: 4, avgDelay: 2.6, lateDeliveries: 5, history: [90, 88, 86, 85, 83, 82] },
  { id: "v-plt", name: "Pune LaserTech", location: "Bhosari", services: "Laser cutting", contact: "Sachin Bhosale", phone: "+91 98230 55120", email: "ops@punelasertech.demo", onTime: 96, health: "Good", activeJobs: 3, avgDelay: 0.4, lateDeliveries: 1, history: [94, 95, 97, 95, 96, 96] },
  { id: "v-htp", name: "HeatTreat Pune", location: "Pimpri", services: "Heat treatment", contact: "Ganesh Pawar", phone: "+91 98908 22314", email: "slots@heattreatpune.demo", onTime: 94, health: "Good", activeJobs: 1, avgDelay: 0.8, lateDeliveries: 1, history: [92, 93, 95, 94, 94, 94] },
  { id: "v-ssc", name: "SS Components India", location: "Chinchwad", services: "SS316L plates and fittings", contact: "Ramesh Naik", phone: "+91 98500 76641", email: "sales@sscomponents.demo", onTime: 87, health: "At Risk", activeJobs: 2, avgDelay: 3.1, lateDeliveries: 4, history: [93, 92, 91, 90, 88, 87] },
  { id: "v-alp", name: "Alpha Surface Finishing", location: "Bhosari", services: "Electropolishing, passivation", contact: "Deepa Kamble", phone: "+91 98816 30977", email: "jobs@alphasurface.demo", onTime: 91, health: "Good", activeJobs: 1, avgDelay: 1.0, lateDeliveries: 2, history: [89, 90, 92, 91, 90, 91] },
  { id: "v-stl", name: "Sterling Instrumentation", location: "Chakan", services: "Probes, transmitters, load cells", contact: "Mahesh Rane", phone: "+91 98221 90456", email: "orders@sterlinginstr.demo", onTime: 89, health: "Good", activeJobs: 2, avgDelay: 1.4, lateDeliveries: 2, history: [88, 90, 89, 88, 90, 89] },
  { id: "v-bds", name: "Bharat Drive Systems", location: "Chinchwad", services: "Motors, gearboxes, drives", contact: "Kiran Sathe", phone: "+91 98905 11876", email: "supply@bharatdrive.demo", onTime: 92, health: "Good", activeJobs: 1, avgDelay: 0.9, lateDeliveries: 1, history: [91, 92, 93, 92, 92, 92] },
  { id: "v-sew", name: "Shivneri Engineering Works", location: "Talegaon", services: "CNC machining, shafts (alternate source)", contact: "Vilas Jadhav", phone: "+91 98230 77412", email: "quotes@shivneriew.demo", onTime: 90, health: "Good", activeJobs: 0, avgDelay: 1.2, lateDeliveries: 2, history: [88, 89, 90, 91, 90, 90], isAlternative: true },
];

type W = [string, string, string, string, string, string, string | undefined, VendorWorkPackage["status"]];
const W0: W[] = [
  ["WP-101", "v-pmw", "FER-24026", "Agitator shaft machining", "10-08", "10-10", undefined, "Delayed"],
  ["WP-102", "v-pmw", "FER-24026", "Flange set machining", "10-14", "10-14", undefined, "In Progress"],
  ["WP-103", "v-pmw", "FER-24021", "Impeller hub machining", "10-20", "10-20", undefined, "Not Started"],
  ["WP-104", "v-pmw", "FER-24017", "Manway ring machining", "09-20", "09-22", "09-22", "Delivered"],
  ["WP-105", "v-plt", "FER-24028", "Shell blank laser cutting", "10-02", "10-02", "10-02", "Delivered"],
  ["WP-106", "v-plt", "FER-24021", "Jacket plate cutting", "10-12", "10-12", undefined, "In Progress"],
  ["WP-107", "v-plt", "FER-24031", "Dish end cutting", "10-16", "10-16", undefined, "Not Started"],
  ["WP-108", "v-htp", "FER-24028", "Shell ring stress relief", "10-12", "10-12", undefined, "In Progress"],
  ["WP-109", "v-ssc", "FER-24033", "SS316L 8 mm sheet supply", "10-06", "10-10", undefined, "Delayed"],
  ["WP-110", "v-ssc", "FER-24017", "Nozzle fittings supply", "09-18", "09-18", "09-18", "Delivered"],
  ["WP-111", "v-alp", "FER-24035", "Internal electropolish", "10-09", "10-09", undefined, "In Progress"],
  ["WP-112", "v-stl", "FER-24024", "Temperature probe supply", "09-30", "09-30", "09-29", "Delivered"],
  ["WP-113", "v-bds", "FER-24031", "Gearbox and motor", "10-30", "10-30", undefined, "Not Started"],
  ["WP-114", "v-sew", "FER-24026", "Agitator shaft (alternate quote)", "10-12", "10-12", undefined, "Not Started"],
];
export const workPackages: VendorWorkPackage[] = W0.map(([id, vendorId, projectId, title, c, f, a, status]) => ({
  id,
  vendorId,
  projectId,
  title,
  committed: D(c),
  forecast: D(f),
  actual: a ? D(a) : undefined,
  status,
}));

type PO = [string, string, string, string, string, string, string, string, string | undefined, PurchaseOrder["status"], number];
const PO0: PO[] = [
  ["PO-2611", "SS316L Sheet 6 mm", "FER-24017", "v-ssc", "PO/26/2611", "4 sheets", "09-18", "09-18", "09-18", "Received", 412000],
  ["PO-2628", "SS316L Sheet 8 mm", "FER-24033", "v-ssc", "PO/26/2628", "3 sheets", "10-06", "10-10", undefined, "Delayed", 286000],
  ["PO-2631", "Agitator Shaft", "FER-24026", "v-pmw", "PO/26/2631", "1 no.", "10-08", "10-10", undefined, "Delayed", 360000],
  ["PO-2619", "Mechanical Seal", "FER-24021", "v-stl", "PO/26/2619", "1 no.", "10-18", "10-16", undefined, "Ordered", 185000],
  ["PO-2605", "Temperature Probe", "FER-24024", "v-stl", "PO/26/2605", "2 nos.", "09-30", "09-29", "09-29", "Received", 24000],
  ["PO-2622", "Laser-cut shell blanks", "FER-24028", "v-plt", "PO/26/2622", "6 sets", "10-02", "10-02", "10-02", "Partially Received", 96000],
  ["PO-2624", "Jacket plates", "FER-24021", "v-ssc", "PO/26/2624", "5 sheets", "10-20", "10-20", undefined, "PO Issued", 540000],
  ["PO-2626", "Shell ring stress relief", "FER-24028", "v-htp", "PO/26/2626", "3 rings", "10-12", "10-12", undefined, "Ordered", 48000],
  ["PO-2633", "Pressure transmitter", "FER-24035", "v-stl", "PO/26/2633", "2 nos.", "10-06", "10-06", "10-06", "QC Pending", 38000],
  ["PO-2635", "Electropolish — internals", "FER-24035", "v-alp", "PO/26/2635", "1 lot", "10-09", "10-09", undefined, "PO Issued", 72000],
  ["PO-2638", "Flanges and ferrules", "FER-24026", "v-pmw", "PO/26/2638", "1 lot", "10-18", "10-18", undefined, "PO Issued", 124000],
  ["PO-2640", "Motor and gearbox", "FER-24031", "v-bds", "PO/26/2640", "1 set", "10-30", "10-30", undefined, "Ordered", 395000],
  ["PO-2642", "Load cells", "FER-24026", "v-stl", "—", "4 nos.", "10-28", "10-28", undefined, "Requested", 210000],
  ["PO-2644", "Sanitary valves", "FER-24031", "v-stl", "—", "12 nos.", "11-05", "11-05", undefined, "RFQ", 168000],
  ["PO-2645", "Sight glasses", "FER-24024", "v-stl", "PO/26/2645", "2 nos.", "09-25", "09-25", "09-25", "Accepted", 18000],
];
export const purchaseOrders: PurchaseOrder[] = PO0.map(([id, item, projectId, vendorId, po, qty, req, exp, act, status, cost]) => ({
  id,
  item,
  projectId,
  vendorId,
  po,
  qty,
  required: D(req),
  expected: D(exp),
  actual: act ? D(act) : undefined,
  status,
  cost,
}));

export const shopJobs: DB["shopJobs"] = [
  { id: "SJ-01", projectId: "FER-24017", name: "Shell longitudinal welding", station: "Weld Bay 1", assignee: "u-ss", hours: 8, status: "Running", progress: 75, materialOk: true, qc: "Visual + DP test after weld" },
  { id: "SJ-02", projectId: "FER-24028", name: "Nozzle fabrication", station: "Fit-up Bay 2", assignee: "u-ss", hours: 6, status: "Running", progress: 70, materialOk: true, qc: "Dimensional check vs drawing" },
  { id: "SJ-03", projectId: "FER-24017", name: "Internal polishing", station: "Finishing Bay", assignee: "u-ss", hours: 10, status: "Pending", progress: 0, materialOk: true, qc: "Ra measurement ≤ 0.5 µm" },
  { id: "SJ-04", projectId: "FER-24024", name: "Agitator assembly", station: "Assembly Bay", assignee: "u-ss", hours: 12, status: "Blocked", progress: 20, materialOk: false, qc: "Shaft runout ≤ 0.05 mm" },
  { id: "SJ-05", projectId: "FER-24031", name: "Support frame fabrication", station: "Structural Bay", assignee: "u-ss", hours: 8, status: "Pending", progress: 0, materialOk: true, qc: "Squareness and weld inspection" },
];

export const siteJobs: DB["siteJobs"] = [
  {
    id: "SITE-24024",
    projectId: "FER-24024",
    customer: "NutraFerment Foods",
    location: "Customer Site — Pune",
    date: D("10-08"),
    tasks: [
      { name: "Foundation inspection", done: true },
      { name: "Vessel placement", done: false },
      { name: "Utility connection", done: false },
      { name: "Instrument installation", done: false },
      { name: "Trial run", done: false },
    ],
  },
  {
    id: "SITE-24017",
    projectId: "FER-24017",
    customer: "BioProcess Solutions",
    location: "Customer Site — Hyderabad",
    date: D("10-09"),
    tasks: [
      { name: "Utility tie-in survey", done: false },
      { name: "Access and lifting plan", done: false },
    ],
  },
];

type DC = [string, string, string, string, string, string, string, string, DocumentRec["status"]];
const DC0: DC[] = [
  ["GA_FER-24026_RevA.pdf", "GA Drawing", "GA", "FER-24026", "A", "u-ma", "09-12", "", "Superseded"],
  ["GA_FER-24026_RevB.pdf", "GA Drawing", "GA", "FER-24026", "B", "u-ma", "09-26", "", "Superseded"],
  ["GA_FER-24026_RevC.pdf", "GA Drawing", "GA", "FER-24026", "C", "u-ma", "10-04", "", "Under Review"],
  ["GA_FER-24021_RevB.pdf", "GA Drawing", "GA", "FER-24021", "B", "u-vk", "09-20", "", "Superseded"],
  ["GA_FER-24021_RevC.pdf", "GA Drawing", "GA", "FER-24021", "C", "u-vk", "10-03", "", "Pending Customer"],
  ["GA_FER-24017_RevB.pdf", "GA Drawing", "GA", "FER-24017", "B", "u-ma", "07-18", "", "Approved"],
  ["FAB_FER-24017_Shell_RevB.pdf", "Fabrication Drawing", "FAB", "FER-24017", "B", "u-ma", "07-28", "", "Issued"],
  ["FAB_FER-24026_Shaft_RevC.pdf", "Fabrication Drawing", "SHAFT", "FER-24026", "C", "u-ma", "10-01", "", "Issued"],
  ["PID_FER-24031_RevB.pdf", "P&ID", "PID", "FER-24031", "B", "u-vk", "09-18", "", "Superseded"],
  ["PID_FER-24031_RevC.pdf", "P&ID", "PID", "FER-24031", "C", "u-vk", "10-02", "", "Issued"],
  ["BOM_FER-24021_RevB.xlsx", "BOM", "BOM", "FER-24021", "B", "u-vk", "09-25", "", "Approved"],
  ["PO_2631_Agitator_Shaft.pdf", "Purchase Order", "PO2631", "FER-24026", "A", "u-sj", "09-30", "", "Issued"],
  ["IR_FER-24035_Hydro_Test.pdf", "Inspection Report", "IRH", "FER-24035", "A", "u-nm", "10-02", "", "Approved"],
  ["WR_FER-24017_Shell_Weld_Log.pdf", "Welding Record", "WR", "FER-24017", "A", "u-nm", "10-08", "", "Under Review"],
  ["MTC_FER-24017_SS316L_6mm.pdf", "Material Test Certificate", "MTC17", "FER-24017", "A", "u-nm", "09-18", "", "Approved"],
  ["MTC_FER-24033_SS316L_8mm.pdf", "Material Test Certificate", "MTC33", "FER-24033", "A", "u-nm", "10-07", "", "Under Review"],
  ["FAT_FER-24035_Protocol_RevA.pdf", "FAT Report", "FAT35", "FER-24035", "A", "u-nm", "10-06", "", "Under Review"],
  ["INS_FER-24024_Foundation_Check.pdf", "Installation Report", "INS24", "FER-24024", "A", "u-it", "10-07", "", "Issued"],
  ["CA_FER-24017_GA_Approval.pdf", "Customer Approval", "CA17", "FER-24017", "A", "u-rk", "07-20", "", "Approved"],
  ["CA_FER-24026_URS_Signoff.pdf", "Customer Approval", "CA26", "FER-24026", "A", "u-rk", "09-10", "", "Approved"],
];
export const documents: DocumentRec[] = DC0.map(([filename, type, series, projectId, rev, by, date, , status], i) => ({
  id: `DOC-${100 + i}`,
  filename,
  type,
  series: `${projectId}-${series}`,
  projectId,
  rev,
  by,
  date: D(date),
  status,
}));

type A0 = [string, string, string | undefined, string, string, Activity["kind"]];
const A: A0[] = [
  ["10-08T10:42", "u-rk", "FER-24017", "updated progress", "Shell welding completed.", "update"],
  ["10-08T10:15", "u-sj", "FER-24026", "logged a vendor update", "Vendor committed revised delivery date: 10 Oct.", "vendor"],
  ["10-08T09:18", "u-nm", "FER-24033", "accepted material", "QC accepted SS316L material test certificates — sheet 6 mm lot.", "quality"],
  ["10-08T09:05", "u-ss", "FER-24017", "started a job", "Internal polishing prepared; awaiting weld clearance.", "update"],
  ["10-08T08:40", "u-vk", "FER-24031", "uploaded a design revision", "P&ID Rev C issued for BioCatalyst review.", "design"],
  ["10-08T08:20", "u-it", "FER-24024", "uploaded field photos", "Anchor bolt re-measurement photos attached to BLK-024.", "field"],
  ["10-07T18:36", "u-it", "FER-24024", "raised a site blocker", "Installation team raised a site blocker: foundation anchor alignment incorrect.", "blocker"],
  ["10-07T17:10", "u-nm", "FER-24035", "completed QC", "Pressure transmitters received; QC pending calibration certificate.", "quality"],
  ["10-07T16:25", "u-ma", "FER-24026", "updated a task", "Agitator assembly drawing held pending shaft confirmation.", "task"],
  ["10-07T15:02", "u-pd", "FER-24021", "followed up with client", "Called customer plant head about GA Rev C approval.", "update"],
  ["10-07T14:30", "u-ap", "FER-24028", "updated a task", "Nozzle fabrication 8 of 11 complete.", "task"],
  ["10-07T12:12", "u-sj", "FER-24033", "escalated a blocker", "BLK-033 escalated to SS Components India director.", "blocker"],
  ["10-07T11:00", "u-ss", "FER-24028", "completed a job", "Shell blank fit-up completed in Fit-up Bay 2.", "update"],
  ["10-07T10:20", "u-owner", "FER-24026", "requested update", "Asked for daily status on the agitator shaft delay.", "update"],
  ["10-07T09:15", "u-rk", "FER-24035", "scheduled FAT", "FAT scheduled for 09 Oct with customer QA witness.", "milestone"],
  ["10-06T17:45", "u-sj", "FER-24026", "created a blocker", "BLK-026 created: agitator shaft machining delayed (Critical).", "blocker"],
  ["10-06T15:30", "u-sj", "FER-24026", "vendor delayed", "Precision Machine Works reported late alloy steel raw material.", "vendor"],
  ["10-06T14:05", "u-vk", "FER-24031", "assigned a task", "Jacket thermal design review assigned to Vikram Kale.", "task"],
  ["10-06T11:40", "u-nm", "FER-24035", "QC passed", "Hydro test passed at 4.5 bar for FER-24035.", "quality"],
  ["10-06T10:05", "u-sj", "FER-24035", "issued a PO", "PO/26/2635 issued to Alpha Surface Finishing for electropolish.", "material"],
  ["10-05T16:50", "u-pd", "FER-24021", "created a blocker", "BLK-021 created: customer drawing approval pending.", "blocker"],
  ["10-05T14:15", "u-sj", "FER-24033", "vendor delayed", "SS Components India revised sheet delivery to 10 Oct.", "vendor"],
  ["10-05T12:00", "u-ss", "FER-24017", "welding progress", "Longitudinal weld seam 1 of 2 completed.", "update"],
  ["10-04T17:20", "u-ma", "FER-24026", "uploaded a design revision", "GA Drawing Rev C uploaded for FER-24026.", "design"],
  ["10-04T15:10", "u-rk", "FER-24026", "client approval received", "Client approved shaft interface dimensions.", "update"],
  ["10-04T11:30", "u-sj", "FER-24021", "placed an order", "Mechanical seal ordered, expected 16 Oct.", "material"],
  ["10-03T16:00", "u-vk", "FER-24021", "uploaded a design revision", "GA Drawing Rev C submitted to customer for approval.", "design"],
  ["10-03T10:45", "u-it", "FER-24024", "completed installation task", "Foundation inspection completed; anchor deviation noted.", "field"],
  ["10-02T15:20", "u-nm", "FER-24035", "uploaded inspection report", "Hydro test inspection report uploaded.", "quality"],
  ["10-02T11:10", "u-ss", "FER-24028", "material received", "Laser-cut shell blanks received (partial — 4 of 6 sets).", "material"],
  ["10-01T14:00", "u-rk", "FER-24017", "milestone update", "Shell Fabrication forecast moved from 06 Oct to 10 Oct (+4 days).", "milestone"],
  ["09-30T16:40", "u-ap", "FER-24024", "resolved a blocker", "Dispatch of vessel to site completed; transport damage ruled out.", "blocker"],
  ["09-29T12:30", "u-sj", "FER-24024", "material received", "Temperature probes received and accepted.", "material"],
];
export const activities: Activity[] = A.map(([ts, userId, projectId, action, description, kind], i) => ({
  id: `ACT-${200 - i}`,
  ts: D(ts),
  userId,
  projectId,
  action,
  description,
  kind,
}));

export const seedNotifications: DB["notifications"] = [
  { id: "N-1", tone: "critical", title: "Critical blocker created", body: "FER-24026 is blocked by vendor machining.", ts: D("10-06T17:45"), read: false, link: { page: "blockers", id: "BLK-026", kind: "blocker" } },
  { id: "N-2", tone: "warning", title: "Task overdue", body: "GA drawing approval follow-up for FER-24021 is overdue.", ts: D("10-07T09:00"), read: false, link: { page: "tasks", id: "T-103", kind: "task" } },
  { id: "N-3", tone: "info", title: "Vendor update", body: "Precision Machine Works revised delivery to 10 Oct.", ts: D("10-08T10:15"), read: false, link: { page: "vendor", id: "v-pmw" } },
  { id: "N-4", tone: "success", title: "Milestone completed", body: "Shell welding completed for FER-24017.", ts: D("10-08T10:42"), read: false, link: { page: "project", id: "FER-24017" } },
  { id: "N-5", tone: "critical", title: "Field team raised a blocker", body: "FER-24024: foundation anchor alignment incorrect.", ts: D("10-07T18:36"), read: true, link: { page: "blockers", id: "BLK-024", kind: "blocker" } },
  { id: "N-6", tone: "warning", title: "Client approval pending", body: "GA Rev C for FER-24021 awaiting customer for 5 days.", ts: D("10-08T08:00"), read: true, link: { page: "project", id: "FER-24021" } },
  { id: "N-7", tone: "info", title: "Task assigned to you", body: "Review assembly sequence for shaft slip (FER-24026).", ts: D("10-08T08:30"), read: false, link: { page: "tasks", id: "T-126", kind: "task" } },
];

export const seedComments: DB["comments"] = [
  { id: "C-1", entityId: "BLK-026", userId: "u-sj", text: "Called Prakash — raw material (EN24 round bar) landed yesterday evening. Machining now starts 09 Oct.", ts: D("10-07T11:05") },
  { id: "C-2", entityId: "BLK-026", userId: "u-rk", text: "Please get the revised date in writing. Check if Shivneri can take the shaft in parallel as backup.", ts: D("10-07T11:40") },
  { id: "C-3", entityId: "BLK-021", userId: "u-pd", text: "Customer reviewer is on leave until 09 Oct. Plant head has promised a decision by Friday.", ts: D("10-07T15:10") },
  { id: "C-4", entityId: "T-101", userId: "u-ss", text: "Seam 2 welded. DP test scheduled after lunch.", ts: D("10-08T09:40") },
];

export const impactSeed = {
  updateChasing: { baseline: 8, pilot: 3.2 },
  blockerDiscovery: { baseline: 2.5, pilot: 0.5 },
  milestones: { baseline: 68, pilot: 83 },
  delayCost: { baseline: 12.5, pilot: 10 },
  healthTrend: [
    { month: "Jul", onTrack: 3, atRisk: 2, blocked: 1 },
    { month: "Aug", onTrack: 4, atRisk: 2, blocked: 1 },
    { month: "Sep", onTrack: 4, atRisk: 2, blocked: 1 },
  ],
};

export const buildSeed = (): DB =>
  structuredClone({
    projects,
    stages,
    tasks,
    milestones,
    blockers,
    vendors,
    workPackages,
    purchaseOrders,
    shopJobs,
    shopUpdates: [],
    siteJobs,
    fieldUpdates: [
      { id: "FU-1", projectId: "FER-24024", status: "Issue raised", issueType: "Foundation / civil", severity: "High", comment: "Two anchor bolts are approximately 12 mm out of alignment.", photo: true, gps: "18.5642° N, 73.8021° E", userId: "u-it", ts: D("10-07T18:36"), blockerId: "BLK-024" },
    ],
    documents,
    activities,
    notifications: seedNotifications,
    comments: seedComments,
  } as DB);
