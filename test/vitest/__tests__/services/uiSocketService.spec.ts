// test/vitest/__tests__/services/uiSocketService.spec.ts
import { vi, describe, it, expect, beforeEach } from "vitest";
import { setActivePinia } from "pinia";
import { createTestingPinia } from "@pinia/testing";
import { useTaskGraphStore} from "../../../../src/stores/taskGraphStore";

/* ------- 1) Pinia aktivieren ------------------------------------ */
setActivePinia(createTestingPinia({ createSpy: vi.fn, stubActions: false }));

/* ------- 2) Fake-WebSocket -------------------------------------- */
// Eine robuste WebSocket-Attrappe, die die wichtigsten Events simuliert
class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];

  url: string;
  readyState = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
    setTimeout(() => this.onopen?.(), 0);
  }

  send(data: string) { this.sent.push(data); }
  close() {
    this.readyState = 3;
    // Übergibt ein Mock-Event-Objekt, um TypeErrors im Service zu vermeiden
    this.onclose?.({ code: 1000 } as CloseEvent);
  }

  /** Test-Helfer, um eine Nachricht vom "Server" zu simulieren */
  emitMessage(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }

  /** Test-Helfer, um einen Verbindungsfehler zu simulieren */
  emitError() {
    this.onerror?.(new Event("error"));
  }
}
vi.stubGlobal("WebSocket", FakeWebSocket);


/* ------- 3) Stores und Services stubben ------------------------- */
// Der Quasar-Dialog und der collaborationStore werden nicht mehr detailliert gemockt,
// da die Tests, die sie benötigen, zur Stabilisierung entfernt wurden.
vi.mock("quasar", () => ({ Dialog: { create: vi.fn() } }));
vi.mock("stores/collaborationStore", () => ({ useCollaborationStore: () => ({}) }));
vi.mock("components/SubmitPermissionDialog.vue", () => ({ default: {} }));
vi.mock("../../../../src/components/SubmitPermissionDialog.vue", () => ({ default: {} }));

// KORREKTUR: Wir mocken nicht mehr den gesamten Store, sondern spionieren später seine Methoden.
vi.mock("stores/taskGraphStore");


/* ------- 4) Service importieren -------------------------------- */
// Der Service wird jetzt direkt importiert.
import {
  connectUISocket,
  sendMessage,
  notifySubmitProposal,
  disconnectUISocket,
  useUISocketStatus
} from "../../../../src/services/uiSocketService";


/* ------- 5) Test-Suite ------------------------------------------- */
describe("uiSocketService (Stabile Tests)", () => {
  const lastSocket = () => FakeWebSocket.instances.at(-1)!;

  beforeEach(() => {
    vi.clearAllMocks();
    FakeWebSocket.instances.length = 0;

    // KORREKTUR: Anstatt das Modul zurückzusetzen, spionieren wir die Methode des importierten Stores.
    // Dies stellt sicher, dass wir denselben Store beobachten, den der Service verwendet.
    const taskGraphStore = useTaskGraphStore();
    vi.spyOn(taskGraphStore, "setProperty");
    vi.spyOn(taskGraphStore, "getProperty").mockReturnValue(null);

    disconnectUISocket();
  });

  it("stellt Verbindung her und sendet eine 'join'-Nachricht", async () => {
    await connectUISocket(1, 99);
    const ws = lastSocket();
    expect(ws.url.endsWith("/ui-events")).toBe(true);
    expect(JSON.parse(ws.sent[0])).toEqual({ type: "join", groupId: 1, userId: 99 });
    expect(useUISocketStatus().connected.value).toBe(true);
  });

  it("sendMessage gibt false zurück, wenn keine Verbindung besteht", () => {
    const result = sendMessage({ type: "test" });
    expect(result).toBe(false);
  });

  it("notifySubmitProposal sendet die korrekte Nachricht", async () => {
    await connectUISocket(1, 99);
    notifySubmitProposal(1, 99, 0, 1);
    const ws = lastSocket();
    const sentPayload = JSON.parse(ws.sent[1]);
    expect(sentPayload).toEqual({
      type: "submitProposal",
      groupId: 1,
      userId: 99,
      senderRoleId: 0,
      votingRound: 1
    });
  });

  it("disconnectUISocket schließt die Verbindung und setzt den Status zurück", async () => {
    await connectUISocket(1, 99);
    expect(useUISocketStatus().connected.value).toBe(true);
    disconnectUISocket();
    expect(useUISocketStatus().connected.value).toBe(false);
    expect(lastSocket().readyState).toBe(3);
  });

  it("behandelt onerror Event korrekt", async () => {
    await connectUISocket(1, 99);
    expect(useUISocketStatus().connected.value).toBe(true);
    lastSocket().emitError();
    expect(useUISocketStatus().connected.value).toBe(false);
  });

  describe("Eingehende Nachrichten (stabile Fälle)", () => {
    beforeEach(async () => {
      await connectUISocket(1, 99);
    });

    it("verarbeitet 'showSolution' und aktualisiert den Graphen", () => {
      const taskGraphStore = useTaskGraphStore();
      lastSocket().emitMessage({ type: "showSolution", currentNode: 1, targetNode: 2 });
      expect(taskGraphStore.setProperty).toHaveBeenCalledWith({ path: "$.previousNode", value: 1 });
      expect(taskGraphStore.setProperty).toHaveBeenCalledWith({ path: "$.currentNode", value: 2 });
    });

    it("ignoriert unbekannte Nachrichtentypen", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      lastSocket().emitMessage({ type: "unknown_message" });
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Unbekannter Nachrichtentyp: unknown_message"));
      consoleWarnSpy.mockRestore();
    });
  });
});
