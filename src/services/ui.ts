import { useEffect, useState } from "react";
import { createStore } from "./store";

export type QuickKind = "progress" | "task" | "blocker" | "vendor" | "material" | "field" | "shop";

interface UI {
  copilot: boolean;
  copilotRequest?: { project?: string; prompt?: string; token: number };
  blockerId?: string;
  taskId?: string;
  newTask?: { projectId?: string } | null;
  newBlocker?: { projectId?: string } | null;
  quick: QuickKind | "menu" | null;
  search: boolean;
  notif: boolean;
  menu: boolean;
  report: boolean;
  simulateError: boolean;
  toasts: { id: number; text: string; tone: "ok" | "info" | "bad" }[];
}
export const uiStore = createStore<UI>({ copilot: false, quick: null, search: false, notif: false, menu: false, report: false, simulateError: false, toasts: [] });
export const useUI = uiStore.use;
export const ui = (patch: Partial<UI>) => uiStore.set((s) => ({ ...s, ...patch }));
let copilotToken = 0;
export const openCopilot = (project?: string, prompt?: string) =>
  ui({ copilot: true, copilotRequest: { project, prompt, token: ++copilotToken } });

let tid = 1;
export const toast = (text: string, tone: "ok" | "info" | "bad" = "ok") => {
  const id = tid++;
  uiStore.set((s) => ({ ...s, toasts: [...s.toasts, { id, text, tone }] }));
  setTimeout(() => uiStore.set((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) })), 3800);
};

export interface Route {
  page: string;
  id?: string;
  tab?: string;
}
const parseHash = (): Route => {
  const [page, id, tab] = window.location.hash.replace(/^#\/?/, "").split("/");
  return { page: page || "dashboard", id: id ? decodeURIComponent(id) : undefined, tab };
};
export const navigate = (path: string) => {
  window.location.hash = "#/" + path.replace(/^\//, "");
  window.scrollTo(0, 0);
};
export const useRoute = (): Route => {
  const [r, setR] = useState<Route>(parseHash);
  useEffect(() => {
    const f = () => setR(parseHash());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return r;
};

export const linkPath = (l: { page: string; id?: string }) => (l.id && ["project", "vendor"].includes(l.page) ? `${l.page}/${l.id}` : l.page);
