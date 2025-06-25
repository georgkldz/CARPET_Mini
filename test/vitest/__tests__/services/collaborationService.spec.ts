/* test/vitest/__tests__/services/collaborationService.spec.ts */
import axios from "axios";
import { vi, describe, it, expect, beforeEach, Mock } from "vitest";
import { setActivePinia } from "pinia";
import { createTestingPinia } from "@pinia/testing";
import type { GroupInfo } from "../../../../src/stores/collaborationStore";

/* 1️⃣ aktive Pinia */
setActivePinia(createTestingPinia({ createSpy: vi.fn, stubActions: false }));

/* 2️⃣ Fake-EventSource */
class FakeEventSource {
  url: string;
  onmessage: ((e: MessageEvent) => void) | null = null;
  constructor(url: string) { this.url = url; FakeEventSource.all.push(this); }
  close() {}
  emit(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent); }
  static all: FakeEventSource[] = [];
}
vi.stubGlobal("EventSource", FakeEventSource);

/* 3️⃣ Axios stubben */
vi.mock("axios");

/* 4️⃣ Stubs mit vi.hoisted() ---------------------------------- */
const taskGraphStub = vi.hoisted(() => ({
  currentNode: 0,
  getCurrentTaskId: 5,
  getProperty: vi.fn().mockReturnValue(undefined),
  setProperty: vi.fn(),
}));

const userStub = vi.hoisted(() => ({
  userId: 99,
  getProficiencyByTaskId: vi.fn().mockReturnValue(7),
}));

const collabStub = vi.hoisted(() => ({
  inGroup: false,
  myCollabRoleId: 0,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setGroup: vi.fn((g: GroupInfo, _uid: number) => { collabStub.inGroup = true; }),
}));

const uiSocketStub = vi.hoisted(() => ({
  connectUISocket: vi.fn().mockResolvedValue(undefined),
  disconnectUISocket: vi.fn(),
  notifyShowSolution: vi.fn(),
  notifySubmitProposal: vi.fn(),
}));

const appJoin = vi.hoisted(() => vi.fn());

/* 5️⃣ Mocks registrieren (nur eine Zeichenkette je Modul) ------ */
vi.mock("../../../../src/stores/taskGraphStore", () => ({
  __esModule: true,
  useTaskGraphStore: () => taskGraphStub,
}));

vi.mock("../../../../src/stores/userStore", () => ({
  __esModule: true,
  useUserStore: () => userStub,
}));

vi.mock("../../../../src/stores/collaborationStore", () => ({
  __esModule: true,
  useCollaborationStore: () => collabStub,
}));

vi.mock("../../../../src/stores/applicationStore", () => ({
  __esModule: true,
  useApplicationStore: () => ({ joinSession: appJoin }),
}));

vi.mock("../../../../src/services/uiSocketService", () => ({
  __esModule: true,
  ...uiSocketStub,
}));

/* 6️⃣ Service importieren – alle Mocks sind jetzt aktiv */
import { joinCollaboration } from "../../../../src/services/collaborationService";

/* 7️⃣ Tests ---------------------------------------------------- */
describe("collaborationService.joinCollaboration", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); collabStub.inGroup = false; });

  it("sendet Score, öffnet SSE und verarbeitet Fallback-Status", async () => {
    (axios.post as unknown as Mock).mockResolvedValue({});
    (axios.get  as unknown as Mock).mockResolvedValue({
      data: { groups: [{ groupId: 1, taskId: 5, memberIds: [99], size: 1, members: [] }] },
    });

    await joinCollaboration();

    expect(axios.post).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/grouping/proficiency",
      { userId: 99, taskId: 5, score: 7 },
    );
    expect(FakeEventSource.all[0]?.url).toBe("http://localhost:3000/api/v1/events");

    await vi.advanceTimersByTimeAsync(4000);
    expect(axios.get).toHaveBeenCalledWith("http://localhost:3000/api/v1/grouping/status");

    expect(collabStub.setGroup).toHaveBeenCalledWith(expect.objectContaining({ groupId: 1 }), 99);
    expect(taskGraphStub.setProperty).toHaveBeenCalledWith({ path: "$.myCollabRoleId", value: 0 });
  });

  it("wirft, wenn keine Proficiency vorhanden ist", async () => {
    userStub.getProficiencyByTaskId.mockReturnValueOnce(null);
    await expect(joinCollaboration()).rejects.toThrow("Keine Proficiency für diese Aufgabe vorhanden");
  });
});
