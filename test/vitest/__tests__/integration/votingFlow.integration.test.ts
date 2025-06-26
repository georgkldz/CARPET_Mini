import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestingPinia } from "@pinia/testing";
import { setActivePinia } from "pinia";
import { useCollaborationStore } from "../../../../src/stores/collaborationStore";
import { useTaskGraphStore } from "../../../../src/stores/taskGraphStore";
import {
  WebSocketMock,
  WebSocketMockControl,
  clearWebSocketMocks,
} from "../../../helpers/wsMock";
import type { WebSocketMockInstance } from "../../../helpers/wsMock";

/**
 * Vereinfachter Voting-Flow-Test:
 * - emit voteRequest -> simuliere Start der Abstimmung
 * - emit voteResult allApproved -> simuliere einstimmige Zustimmung
 * - prüfe, ob previousNode und currentNode korrekt gesetzt wurden
 */

describe("Voting-Flow – Minimal", () => {
  let ws: WebSocketMockInstance;

  beforeEach(async () => {
    // Reset Mocks
    vi.clearAllMocks();
    clearWebSocketMocks();

    // Register WebSocket mock before store init
    globalThis.WebSocket = WebSocketMock as unknown as typeof WebSocket;

    // Init Pinia & Stores
    setActivePinia(createTestingPinia({ stubActions: false, createSpy: vi.fn }));
    const collab = useCollaborationStore();
    const task  = useTaskGraphStore();

    // Setze Kante für Node-Wechsel
    task.setProperty({ path: "$.edges", value: { 5: [6] } });
    task.setProperty({ path: "$.currentNode", value: 5 });

    // Gruppensetup löst connectUISocket aus
    collab.setGroup(
      { groupId: 99, taskId: 42, size: 2, memberIds: [1,2],
        members: [ {userId:1,collabRoleId:0,nickname:"A"}, {userId:2,collabRoleId:1,nickname:"B"} ]
      },
      2, // current user
    );

    // Warte auf WebSocket Instanz & Handler
    await vi.dynamicImportSettled();
    ws = WebSocketMockControl.instances[0]!;
    if (!ws) throw new Error("WebSocket-Mock fehlt");
    while (!ws.onmessage) await Promise.resolve();
  });

  it("setzt Musterlösung nach allApproved", async () => {
    const collab = useCollaborationStore();
    const task   = useTaskGraphStore();

    ws.emitServer({ type: "voteResult", allApproved: true });
    // Warte auf finishVoting() und showSampleSolution() Async
    await Promise.resolve();


    expect(collab.isVotingInProgress).toBe(false);

    // ShowSampleSolution manuell ausführen, um Node-Wechsel zu simulieren
    await collab.showSampleSolution();

    expect(task.previousNode).toBe(5);
    expect(task.currentNode).toBe(6);
  });
});
