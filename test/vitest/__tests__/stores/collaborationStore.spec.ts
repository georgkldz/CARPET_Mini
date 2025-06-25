import { setActivePinia } from "pinia";
import { createTestingPinia } from "@pinia/testing";
import { vi, describe, it, expect, beforeEach, Mock } from "vitest";
import { GroupInfo, useCollaborationStore } from "../../../../src/stores/collaborationStore";

/* ───────────── Axios global stubben ───────────── */
vi.mock("axios");

/* ───────────── UI-Socket-Service ──────────────── */
vi.mock("../../../../src/services/uiSocketService", () => {
  return {
    __esModule: true,
    connectUISocket: vi.fn().mockResolvedValue(undefined),
    disconnectUISocket: vi.fn(),
    notifyShowSolution: vi.fn().mockReturnValue(true),
    notifySubmitProposal: vi.fn().mockReturnValue(true),
  };
});

/* optional: Alias-Pfad abfangen, falls in Zukunft genutzt */
vi.mock("services/uiSocketService", () => {
  return {
    __esModule: true,
    connectUISocket: vi.fn().mockResolvedValue(undefined),
    disconnectUISocket: vi.fn(),
    notifyShowSolution: vi.fn().mockReturnValue(true),
    notifySubmitProposal: vi.fn().mockReturnValue(true),
  };
});

/* Nach den Mocks importieren, damit die Spies greifbar sind */
import * as uiSocketService from "../../../../src/services/uiSocketService";
import axios from "axios";

/* ───────────── Automerge-Sync - Helfer ─────────── */
vi.mock("stores/sync/automergeSync", () => ({
  leaveSession: vi.fn().mockResolvedValue(undefined),
  softResetSession: vi.fn().mockResolvedValue(true),
}));

/* ───────────── SSE-Listener resetten ───────────── */
vi.mock("../../../../src/services/collaborationService", () => ({
  resetSSEListener: vi.fn(),
}));

/* ───────────── TaskGraph-Store (Singleton) ─────── */
const taskGraphStub = vi.hoisted(() => ({
  currentNode: 1,
  previousNode: null,
  getProperty: vi.fn((path: string) => {
    switch (path) {
      case "$.roles":
        return {
          "0": { name: "Sprecher", description: "", writeAccess: [], colorHex: "#ff0000" },
          "1": { name: "Schreiber", description: "", writeAccess: [], colorHex: "#00ff00" },
        };
      case "$.nodes":
        return {
          "2": {
            collaboration: { mode: "collaboration", transferToCollab: ["fieldValue"] },
            components: {},
          },
        };
      case "$.edges":
        return { 1: [2] };
      default:
        return null;
    }
  }),
  setProperty: vi.fn(),
  clearSinglePhaseValues: vi.fn(),
  resetValuesByPath: vi.fn(),
  extractSessionData: vi.fn().mockReturnValue({}),
}));

vi.mock("stores/taskGraphStore", () => ({
  useTaskGraphStore: () => taskGraphStub,
}));

vi.mock("../../../../src/stores/taskGraphStore", () => ({
  useTaskGraphStore: () => taskGraphStub,
}));

/* ───────────── Test-Suite ──────────────────────── */
describe("collaborationStore", () => {
  let store: ReturnType<typeof useCollaborationStore>;

  beforeEach(() => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false });
    setActivePinia(pinia);
    store = useCollaborationStore();
    vi.clearAllMocks();
  });

  it("hat anfänglich leeren Zustand", () => {
    expect(store.group).toBeNull();
    expect(store.roleInfos).toEqual({});
    expect(store.inGroup).toBe(false);
  });

  it("setGroup speichert Werte und verbindet Socket", () => {
    const grp: GroupInfo = {
      groupId: 10,
      taskId: 3,
      size: 2,
      memberIds: [5, 6],
      members: [
        { userId: 5, collabRoleId: 0, nickname: "A" },
        { userId: 6, collabRoleId: 1, nickname: "B" },
      ],
    };

    store.setGroup(grp, 5);

    expect(store.groupId).toBe(10);
    expect(uiSocketService.connectUISocket).toHaveBeenCalledWith(10, 5);
    expect(store.roleInfos[0].name).toBe("Sprecher");
    expect(store.inGroup).toBe(true);
  });

  it("startSubmitProposal erhöht Runde und feuert Socket-Event", () => {
    store.group = {
      groupId: 10,
      taskId: 3,
      size: 1,
      memberIds: [5],
      members: [{ userId: 5, collabRoleId: 0, nickname: "A" }],
    } as GroupInfo;
    store.groupId = 10;
    store.myUserId = 5;

    store.startSubmitProposal();

    expect(store.currentVotingRound).toBe(1);
    expect(store.isVotingInProgress).toBe(true);
    expect(uiSocketService.notifySubmitProposal).toHaveBeenCalled();
  });

  it("finishVoting(true) beendet Abstimmung und ruft showSampleSolution", () => {
    const spy = vi.spyOn(store, "showSampleSolution").mockResolvedValue(undefined);
    store.finishVoting(true);
    expect(store.isVotingInProgress).toBe(false);
    expect(spy).toHaveBeenCalled();
  });

  it("clearGroup setzt alles zurück und ruft Soft-Reset", async () => {
    store.groupId = 10;
    store.myUserId = 5;
    store.group = { groupId: 10, taskId: 3, size: 0, members: [], memberIds: [] } as GroupInfo;

    (axios.post as unknown as Mock).mockResolvedValue({});

    /* clearCollaborationInputs stubben, um tiefe Graph-Pfade zu vermeiden */
    vi.spyOn(store, "clearCollaborationInputs").mockImplementation(() => {});

    await store.clearGroup();

    expect(uiSocketService.disconnectUISocket).toHaveBeenCalled();
    expect(taskGraphStub.clearSinglePhaseValues).toHaveBeenCalled();
    expect(store.group).toBeNull();
  });
});
