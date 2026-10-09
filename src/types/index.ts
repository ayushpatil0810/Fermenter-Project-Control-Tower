export type Role =
  | "Owner"
  | "Project Manager"
  | "Design Engineer"
  | "Procurement"
  | "Shop Floor"
  | "Installation"
  | "Vendor";

export const ROLES: Role[] = [
  "Owner",
  "Project Manager",
  "Design Engineer",
  "Procurement",
  "Shop Floor",
  "Installation",
  "Vendor",
];

export interface User {
  id: string;
  name: string;
  title: string;
  role: Role;
  email: string;
  vendorId?: string;
}

export type Health = "On Track" | "At Risk" | "Blocked";
export type Priority = "Critical" | "High" | "Medium" | "Low";
export type TaskStatus = "Not Started" | "In Progress" | "Waiting" | "Blocked" | "Completed" | "Overdue";
export type BlockerStatus = "Open" | "Investigating" | "Waiting" | "Escalated" | "Resolved";
export type BlockerCategory =
  | "Engineering"
  | "Procurement"
  | "Vendor"
  | "Material"
  | "Fabrication"
  | "Quality"
  | "Customer"
  | "Installation"
  | "Logistics"
  | "Documentation";

export const STAGES = [
  "Customer Requirement",
  "Engineering",
  "Drawing Approval",
  "Procurement",
  "Fabrication",
  "Assembly",
  "FAT / Inspection",
  "Dispatch",
  "Installation",
  "Commissioning",
  "Handover",
] as const;
export type StageName = (typeof STAGES)[number];

export interface Project {
  id: string;
  customer: string;
  equipment: string;
  type: "Fermenter" | "Bioreactor";
  capacity: number;
  material: string;
  automation: string;
  pm: string;
  stage: StageName;
  stagePct: number;
  progress: number;
  health: Health;
  healthReason: string;
  value: number;
  start: string;
  delivery: string;
  siteCity: string;
  currentRisk?: string;
}

export interface ProjectStage {
  projectId: string;
  name: StageName;
  status: "Completed" | "In Progress" | "Waiting" | "Blocked" | "Upcoming";
  pct: number;
  planned: string;
  actual?: string;
  owner: string;
}

export interface Task {
  id: string;
  name: string;
  projectId: string;
  workstream: string;
  owner: string;
  priority: Priority;
  status: TaskStatus;
  start: string;
  due: string;
  dependency?: string;
  estHours: number;
  actHours: number;
  notes: string;
  attachments: string[];
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  planned: string;
  forecast: string;
  actual?: string;
  pct: number;
}

export interface Blocker {
  id: string;
  projectId: string;
  title: string;
  description: string;
  category: BlockerCategory;
  severity: Priority;
  owner: string;
  vendorId?: string;
  created: string;
  due: string;
  forecast?: string;
  status: BlockerStatus;
  impact: string;
  costImpact: number;
  scheduleImpact: number;
  resolution?: string;
  attachments: string[];
  actions: { label: string; done: boolean }[];
}

export interface Vendor {
  id: string;
  name: string;
  location: string;
  services: string;
  contact: string;
  phone: string;
  email: string;
  onTime: number;
  health: "Good" | "At Risk";
  activeJobs: number;
  avgDelay: number;
  lateDeliveries: number;
  history: number[];
  isAlternative?: boolean;
}

export type WPStatus = "Not Started" | "In Progress" | "Delayed" | "Delivered";
export interface VendorWorkPackage {
  id: string;
  vendorId: string;
  projectId: string;
  title: string;
  committed: string;
  forecast: string;
  actual?: string;
  status: WPStatus;
}

export type POStatus =
  | "Requested"
  | "RFQ"
  | "PO Issued"
  | "Ordered"
  | "Partially Received"
  | "Received"
  | "QC Pending"
  | "Accepted"
  | "Delayed";
export const PO_STATUSES: POStatus[] = [
  "Requested",
  "RFQ",
  "PO Issued",
  "Ordered",
  "Partially Received",
  "Received",
  "QC Pending",
  "Accepted",
  "Delayed",
];
export interface PurchaseOrder {
  id: string;
  item: string;
  projectId: string;
  vendorId: string;
  po: string;
  qty: string;
  required: string;
  expected: string;
  actual?: string;
  status: POStatus;
  cost: number;
}

export interface ShopJob {
  id: string;
  projectId: string;
  name: string;
  station: string;
  assignee: string;
  hours: number;
  status: "Pending" | "Running" | "Paused" | "Completed" | "Blocked";
  progress: number;
  materialOk: boolean;
  qc: string;
}

export interface ShopFloorUpdate {
  id: string;
  jobId: string;
  projectId: string;
  status: string;
  progress: number;
  comment: string;
  photo?: boolean;
  userId: string;
  ts: string;
}

export interface SiteJob {
  id: string;
  projectId: string;
  customer: string;
  location: string;
  date: string;
  tasks: { name: string; done: boolean }[];
}

export interface FieldUpdate {
  id: string;
  projectId: string;
  status: string;
  issueType: string;
  severity: Priority | "None";
  comment: string;
  photo: boolean;
  gps: string;
  userId: string;
  ts: string;
  blockerId?: string;
}

export interface DocumentRec {
  id: string;
  filename: string;
  type: string;
  series: string;
  projectId: string;
  rev: string;
  by: string;
  date: string;
  status: "Approved" | "Under Review" | "Issued" | "Superseded" | "Pending Customer" | "Rejected";
}

export interface Activity {
  id: string;
  ts: string;
  userId: string;
  projectId?: string;
  action: string;
  description: string;
  kind: "update" | "blocker" | "vendor" | "material" | "design" | "field" | "quality" | "milestone" | "task";
}

export interface AppNotification {
  id: string;
  tone: "critical" | "warning" | "info" | "success";
  title: string;
  body: string;
  ts: string;
  read: boolean;
  link?: { page: string; id?: string; kind?: "blocker" | "task" };
}

export interface Comment {
  id: string;
  entityId: string;
  userId: string;
  text: string;
  ts: string;
}

export interface DB {
  projects: Project[];
  stages: ProjectStage[];
  tasks: Task[];
  milestones: Milestone[];
  blockers: Blocker[];
  vendors: Vendor[];
  workPackages: VendorWorkPackage[];
  purchaseOrders: PurchaseOrder[];
  shopJobs: ShopJob[];
  shopUpdates: ShopFloorUpdate[];
  siteJobs: SiteJob[];
  fieldUpdates: FieldUpdate[];
  documents: DocumentRec[];
  activities: Activity[];
  notifications: AppNotification[];
  comments: Comment[];
}
