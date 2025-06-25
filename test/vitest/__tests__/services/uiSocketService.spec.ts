// test/vitest/__tests__/services/uiSocketService.spec.ts
import { vi, describe, it, expect, beforeEach } from "vitest";
import { setActivePinia } from "pinia";
import { createTestingPinia } from "@pinia/testing";

/* ------- 1) Pinia aktivieren ------------------------------------ */
setActivePinia(createTestingPinia({ createSpy: vi.fn, stubActions: false }));

/* ------- 2) Fake-WebSocket -------------------------------------- */
class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];        // 1️⃣  eindeutiger Name

  url: string;
  readyState = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
    setTimeout(() => this.onopen?.(), 0);        // öffnet die Verbindung
  }

  send(data: string) { this.sent.push(data); }
  close() { this.readyState = 3; }

  /** Test-Helfer, feuert eine JSON-Nachricht */
  emitMessage(payload: unknown) {               // 2️⃣  jetzt deklariert
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }
}
vi.stubGlobal("WebSocket", FakeWebSocket);


/* ------- 3) Quasar-Dialog stubben ------------------------------- */
const onOkSpy = vi.fn();
const onCancelSpy = vi.fn();
vi.mock("quasar", () => ({
  __esModule: true,
  Dialog: {
    create: vi.fn(() => ({
      onOk(fn: (v: "accepted" | "rejected") => void) {
        onOkSpy(fn);                 //  ← Spy wird gezählt
        onOkSpy.mockImplementation(fn);
        return this;
      },
      onCancel(fn: () => void) {
        onCancelSpy(fn);
        onCancelSpy.mockImplementation(fn);
        return this;
      },
    })),
  },
  useDialogPluginComponent() {
    return {
      emits: ["ok", "cancel"],
      onDialogOK: onOkSpy,
      onDialogCancel: onCancelSpy,
    };
  },
}));


/* ---------- Mock für SubmitPermissionDialog ------------------ */
/*  Alle möglichen Auflösungswege zeigen auf ein Dummy-Component */
function mockDialog() {
  return { __esModule: true, default: { template: "<div />" } };
}

vi.mock("components/SubmitPermissionDialog.vue", mockDialog);           // Alias
vi.mock("../../../../src/components/SubmitPermissionDialog.vue", mockDialog); // src-relativ
vi.mock("../components/SubmitPermissionDialog.vue", mockDialog);

/* ------- 4) Stores stubben ------------------------------------- */
const taskGraphStub = { setProperty: vi.fn(), getProperty: vi.fn().mockReturnValue(undefined) };
vi.mock("stores/taskGraphStore", () => ({ __esModule: true, useTaskGraphStore: () => taskGraphStub }));
const collabStub = {
  inGroup: false,
  myCollabRoleId: 0,
  myUserId: 99,

  // damit vorhandene Tests zu finishVoting unverändert bleiben
  finishVoting: vi.fn(),

  /* setzt bei Gruppenzuweisung sowohl Flag als auch myUserId  */
  setGroup: vi.fn((g: GroupInfo, uid: number) => {
    collabStub.inGroup  = true;
    collabStub.myUserId = uid;   // ← hier den Wert übernehmen
  }),
};
vi.mock("stores/collaborationStore", () => ({ __esModule: true, useCollaborationStore: () => collabStub }));
vi.mock("components/SubmitPermissionDialog.vue", () => ({
  __esModule: true,
  /*  eine leere Platzhalter-Komponente  */
  default: { template: "<div />" },
}));
/* ------- 5) Service importieren -------------------------------- */
import {
  connectUISocket,
  sendMessage,
  notifySubmitProposal,
  notifyShowSolution,
  sendVote,
  useUISocketStatus, disconnectUISocket
} from "../../../../src/services/uiSocketService";
import { GroupInfo } from "../../../../src/stores/collaborationStore";

/* ------- 6) Helpers ------------------------------------------- */
const lastSocket = () => FakeWebSocket.instances.at(-1)!;

/* ------- 7) Tests --------------------------------------------- */
describe("uiSocketService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeWebSocket.instances.length = 0;

    // offene Verbindung sauber schließen und Status zurücksetzen
    disconnectUISocket();
    useUISocketStatus().connected.value  = false;
    useUISocketStatus().connecting.value = false;
  });

  it("stellt Verbindung her und sendet join-Nachricht", async () => {
    await connectUISocket(1, 99);

    const ws = lastSocket();
    expect(ws.url.endsWith("/ui-events")).toBe(true);
    expect(JSON.parse(ws.sent[0])).toEqual({ type: "join", groupId: 1, userId: 99 });
    expect(useUISocketStatus().connected.value).toBe(true);
  });

  it("sendMessage gibt false, wenn kein Socket offen ist", () => {
    expect(sendMessage({ type: "dummy" })).toBe(false);
  });

  it("liefert korrekte Payloads für submitProposal / vote / showSolution", async () => {
    await connectUISocket(1, 99);
    notifySubmitProposal(1, 99, 0, 3);
    sendVote(1, 99, "accepted", 3);
    notifyShowSolution(1, 99, 0, 5);

    const payloads = lastSocket().sent.slice(1).map(s => JSON.parse(s));
    expect(payloads).toEqual([
      { type: "submitProposal", groupId: 1, userId: 99, senderRoleId: 0, votingRound: 3 },
      { type: "vote", groupId: 1, userId: 99, vote: "accepted", votingRound: 3 },
      { type: "showSolution", groupId: 1, userId: 99, senderRoleId: 0, currentNode: 5 },
    ]);
  });

});
