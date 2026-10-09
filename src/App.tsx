import { useSession } from "@/services/db";
import { useRoute } from "@/services/ui";
import Shell, { allowedPages } from "@/layouts/Shell";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import Tasks from "@/pages/Tasks";
import Blockers from "@/pages/Blockers";
import { Vendors, VendorDetail } from "@/pages/Vendors";
import Procurement from "@/pages/Procurement";
import ShopFloor from "@/pages/ShopFloor";
import Field from "@/pages/Field";
import Documents from "@/pages/Documents";
import ActivityFeed from "@/pages/ActivityFeed";
import Impact from "@/pages/Impact";
import Settings from "@/pages/Settings";

export default function App() {
  const session = useSession();
  const route = useRoute();
  if (!session) return <Login />;
  const base = route.page === "project" ? "projects" : route.page === "vendor" ? "vendors" : route.page;
  const page = allowedPages(session.role).includes(base) ? route.page : "dashboard";
  const body = (() => {
    switch (page) {
      case "copilot": return <Dashboard />;
      case "projects": return <Projects />;
      case "project": return <ProjectDetail key={route.id} id={route.id!} tab={route.tab} />;
      case "tasks": return <Tasks />;
      case "blockers": return <Blockers />;
      case "vendors": return <Vendors />;
      case "vendor": return <VendorDetail key={route.id} id={route.id!} />;
      case "procurement": return <Procurement />;
      case "shopfloor": return <ShopFloor />;
      case "field": return <Field />;
      case "documents": return <Documents />;
      case "activity": return <ActivityFeed />;
      case "impact": return <Impact />;
      case "settings": return <Settings />;
      default: return <Dashboard />;
    }
  })();
  return <Shell key={session.userId}>{body}</Shell>;
}
