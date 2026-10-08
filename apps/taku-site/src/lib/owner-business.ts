import {
  getWorkspaceSession,
  saveAppSession,
  type WorkspaceSession,
} from "./auth";

const STORAGE_KEY = "MOJARRERIA_TAKU_OWNER_SELECTED_WORKSPACE";
const STORAGE_VERSION = 1;

type StoredSelection = {
  version: number;
  workspaceId: string;
};

export function readLastSelectedWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSelection>;
    if (parsed.version !== STORAGE_VERSION) return null;
    if (typeof parsed.workspaceId !== "string" || !parsed.workspaceId)
      return null;
    return parsed.workspaceId;
  } catch {
    return null;
  }
}

export function writeLastSelectedWorkspaceId(workspaceId: string) {
  if (typeof window === "undefined" || !workspaceId) return;
  const payload: StoredSelection = {
    version: STORAGE_VERSION,
    workspaceId,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function switchClientWorkspace(
  workspaceId: string,
): WorkspaceSession | null {
  const session = getWorkspaceSession();
  if (!session) return null;
  const next = session.workspaces.find((item) => item.id === workspaceId);
  if (!next) return null;
  const updated: WorkspaceSession = {
    ...session,
    currentWorkspace: next,
    role: next.role,
  };
  saveAppSession(updated);
  return updated;
}
