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
  extractSessionData: vi.fn().mockReturnValue({ collaborationNodes: {}, taskData: {} }),
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

    // KORREKTUR: Setzt die Implementierung des Mocks vor jedem Test zurück, um Test-Pollution zu verhindern.
    taskGraphStub.getProperty.mockImplementation((path: string) => {
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
          return { "1": [2] }; // Explizit String-Key für Konsistenz
        default:
          return null;
      }
    });
  });

  it("hat anfänglich leeren Zustand", () => {
    expect(store.group).toBeNull();
    expect(store.roleInfos).toEqual({});
    expect(store.inGroup).toBe(false);
  });

  describe("getters", () => {
    beforeEach(() => {
      store.group = {
        groupId: 10, taskId: 3, size: 2, memberIds: [5, 6],
        members: [
          { userId: 5, collabRoleId: 0, nickname: "A" },
          { userId: 6, collabRoleId: 1, nickname: "B" },
        ],
      } as GroupInfo;
      store.myUserId = 5;
    });

    it("myCollabRoleId gibt korrekte Rollen-ID oder null zurück", () => {
      expect(store.myCollabRoleId).toBe(0);
      store.myUserId = 99; // Benutzer nicht in der Gruppe
      expect(store.myCollabRoleId).toBeNull();
    });

    it("roleOf gibt die korrekte Rollen-ID für eine gegebene Benutzer-ID zurück", () => {
      expect(store.roleOf(6)).toBe(1);
      expect(store.roleOf(99)).toBeNull(); // Benutzer nicht in der Gruppe
    });
  });

  describe("actions", () => {
    const testGroup: GroupInfo = {
      groupId: 10, taskId: 3, size: 2, memberIds: [5, 6],
      members: [
        { userId: 5, collabRoleId: 0, nickname: "A" },
        { userId: 6, collabRoleId: 1, nickname: "B" },
      ],
    };

    it("setGroup speichert Werte, verbindet Socket und lädt Rollen", () => {
      store.setGroup(testGroup, 5);

      expect(store.groupId).toBe(10);
      expect(store.myUserId).toBe(5);
      expect(store.inGroup).toBe(true);
      expect(uiSocketService.connectUISocket).toHaveBeenCalledWith(10, 5);
      expect(store.roleInfos[0].name).toBe("Sprecher");
    });

    it("setRoleInfos behandelt leere oder ungültige Rollendaten", () => {
      taskGraphStub.getProperty.mockReturnValueOnce(undefined);
      store.setRoleInfos();
      expect(store.roleInfos).toEqual({});
    });

    it("clearGroup setzt alles zurück und ruft Soft-Reset auf", async () => {
      store.groupId = 10;
      store.myUserId = 5;
      store.group = testGroup;
      (axios.post as unknown as Mock).mockResolvedValue({});
      vi.spyOn(store, "clearCollaborationInputs").mockImplementation(() => {});

      await store.clearGroup();

      expect(uiSocketService.disconnectUISocket).toHaveBeenCalled();
      expect(taskGraphStub.clearSinglePhaseValues).toHaveBeenCalled();
      expect(store.group).toBeNull();
    });

    it("clearCollaborationInputs sammelt und setzt die korrekten Pfade zurück", () => {
      const nestedComponents = {
        formComponents: {
          field1: { type: "InputField", componentConfiguration: { isCommentable: true }, state: { fieldValue: "a" } },
          field2: { type: "InputField", componentConfiguration: { isCommentable: false }, state: { fieldValue: "b" } },
        }
      };
      // KORREKTUR: Die Mock-Implementierung wird mit `as any` versehen, um den komplexen Typfehler zu umgehen.
      taskGraphStub.getProperty.mockImplementation(((path: string) => {
        if (path === "$.nodes") return { "2": { collaboration: { mode: "collaboration", transferToCollab: ["fieldValue"] } } };
        if (path === "$.nodes.2.components") return { "form1": {} };
        if (path === "$.nodes.2.components.form1.nestedComponents") return nestedComponents;
        return null;
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      }) as any);

      store.clearCollaborationInputs();

      const expectedPath = "$.nodes.2.components.form1.nestedComponents.formComponents.field1.state.fieldValue";
      expect(taskGraphStub.resetValuesByPath).toHaveBeenCalledWith([expectedPath]);
    });

    describe("saveSessionData", () => {
      it("sendet korrekte Daten an das Backend und gibt sessionId zurück", async () => {
        store.setGroup(testGroup, 5);
        (axios.post as unknown as Mock).mockResolvedValue({ data: { sessionId: 123 } });

        const sessionId = await store.saveSessionData();

        expect(axios.post).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/sessionData",
          expect.objectContaining({ taskId: 3, memberIds: [[0, 5], [1, 6]] })
        );
        expect(sessionId).toBe(123);
      });

      it("gibt null zurück, wenn das Speichern fehlschlägt", async () => {
        store.setGroup(testGroup, 5);
        (axios.post as unknown as Mock).mockRejectedValue(new Error());
        const sessionId = await store.saveSessionData();
        expect(sessionId).toBeNull();
      });
    });

    describe("startSubmitProposal", () => {
      beforeEach(() => {
        store.group = testGroup;
        store.groupId = 10;
        store.myUserId = 5;
      });

      it("erhöht Runde und feuert Socket-Event, wenn Benutzer Sprecher ist", () => {
        store.startSubmitProposal();
        expect(store.currentVotingRound).toBe(1);
        expect(store.isVotingInProgress).toBe(true);
        expect(uiSocketService.notifySubmitProposal).toHaveBeenCalled();
      });

      it("tut nichts, wenn der Benutzer nicht der Sprecher ist", () => {
        store.myUserId = 6; // Nicht Sprecher
        store.startSubmitProposal();
        expect(store.currentVotingRound).toBe(0);
        expect(uiSocketService.notifySubmitProposal).not.toHaveBeenCalled();
      });
    });

    describe("finishVoting", () => {
      it("ruft showSampleSolution auf, wenn die Abstimmung angenommen wurde", () => {
        const spy = vi.spyOn(store, "showSampleSolution").mockResolvedValue(undefined);
        store.finishVoting(true);
        expect(store.isVotingInProgress).toBe(false);
        expect(spy).toHaveBeenCalled();
      });

      it("setzt nur den Abstimmungsstatus zurück, wenn die Abstimmung abgelehnt wurde", () => {
        const spy = vi.spyOn(store, "showSampleSolution");
        store.finishVoting(false);
        expect(store.isVotingInProgress).toBe(false);
        expect(spy).not.toHaveBeenCalled();
      });
    });

    describe("showSampleSolution", () => {
      // KORRIGIERTER TESTFALL
      it("speichert die Session und navigiert zum nächsten Knoten", async () => {
        vi.spyOn(store, "saveSessionData").mockResolvedValue(123);
        await store.showSampleSolution();

        // 1. Prüfen, ob die Session gespeichert wurde
        expect(store.saveSessionData).toHaveBeenCalled();

        // 2. Prüfen, ob der vorherige Knoten korrekt gesetzt wurde
        expect(taskGraphStub.setProperty).toHaveBeenCalledWith({
          path: "$.previousNode",
          value: 1,
        });

        // 3. Prüfen, ob der aktuelle Knoten zum nächsten Knoten aus den Edges gewechselt wurde
        expect(taskGraphStub.setProperty).toHaveBeenCalledWith({
          path: "$.currentNode",
          value: 2,
        });
      });
    });
  });
});
