import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestingPinia } from "@pinia/testing";
import { setActivePinia } from "pinia";
import { useCollaborationStore } from "../../../../src/stores/collaborationStore";
import * as uiSocketService from "../../../../src/services/uiSocketService";
import { WebSocketMock, clearWebSocketMocks } from "../../../helpers/wsMock";

// Interface für das erweiterte uiSocketService
interface MockedUISocketService {
  connectUISocket: ReturnType<typeof vi.fn>;
  disconnectUISocket: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
  notifySubmitProposal: ReturnType<typeof vi.fn>;
  notifyShowSolution: ReturnType<typeof vi.fn>;
  sendVote: ReturnType<typeof vi.fn>;
  useUISocketStatus: ReturnType<typeof vi.fn>;
  __mockSocket: {
    readyState: number;
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
}

// ----- globale Stubs -----
vi.stubGlobal("WebSocket", WebSocketMock as unknown as typeof WebSocket);

// Mock das gesamte uiSocketService Modul
vi.mock("../../../../src/services/uiSocketService", () => {
  const mockSocket = {
    readyState: 1, // WebSocket.OPEN
    send: vi.fn(),
    close: vi.fn()
  };

  const mockedService: MockedUISocketService = {
    connectUISocket: vi.fn().mockResolvedValue(undefined),
    disconnectUISocket: vi.fn(),
    sendMessage: vi.fn().mockImplementation((message) => {
      // Simuliere das Senden der Nachricht
      if (mockSocket.readyState === 1) {
        mockSocket.send(JSON.stringify(message));
        return true;
      }
      return false;
    }),
    notifySubmitProposal: vi.fn().mockImplementation((groupId, userId, senderRoleId, votingRound) => {
      const message = {
        type: "submitProposal",
        groupId,
        userId,
        senderRoleId,
        votingRound
      };
      // Verwende sendMessage
      return mockedService.sendMessage(message);
    }),
    notifyShowSolution: vi.fn().mockReturnValue(true),
    sendVote: vi.fn().mockReturnValue(true),
    useUISocketStatus: vi.fn().mockReturnValue({
      connected: { value: true },
      connecting: { value: false }
    }),
    // Expose mockSocket für Tests
    __mockSocket: mockSocket
  };

  return mockedService;
});

// ----- Store-Fixture -----
async function init(roleId: number) {
  setActivePinia(createTestingPinia({ stubActions: false, createSpy: vi.fn }));
  const collab = useCollaborationStore();

  // Mock roleInfos um die Fehlermeldungen zu vermeiden
  collab.roleInfos = {
    0: { roleId: 0, name: "Sprecher", description: "", writeAccess: [], colorHex: "#000000" },
    1: { roleId: 1, name: "Mitglied", description: "", writeAccess: [], colorHex: "#111111" }
  };

  // Mock setRoleInfos damit es nicht versucht vom taskGraphStore zu lesen
  collab.setRoleInfos = vi.fn();

  collab.setGroup(
    {
      groupId: 99,
      taskId: 42,
      size: 2,
      memberIds: [1, 2],
      members: [
        { userId: 1, collabRoleId: 0, nickname: "A" },
        { userId: 2, collabRoleId: 1, nickname: "B" }
      ]
    },
    1 // myUserId
  );

  // Warte kurz damit die Mock-Verbindung etabliert ist
  await new Promise(resolve => setTimeout(resolve, 10));

  // Override myCollabRoleId getter
  Object.defineProperty(collab, "myCollabRoleId", {
    get: () => roleId,
    configurable: true
  });

  return collab;
}

describe("submitProposal – nur Ergebnis-Verantwortlicher darf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearWebSocketMocks();
    // Reset mock socket state
    const mockSocket = (uiSocketService as unknown as MockedUISocketService).__mockSocket;
    if (mockSocket) {
      mockSocket.readyState = 1;
      mockSocket.send.mockClear();
    }
  });

  it("startet Abstimmung, wenn RoleId 0", async () => {
    const collab = await init(0); // Sprecher

    // Spy auf die echte startSubmitProposal Methode
    const startSubmitProposalSpy = vi.spyOn(collab, 'startSubmitProposal');

    collab.startSubmitProposal();

    expect(collab.isVotingInProgress).toBe(true);
    expect(collab.currentVotingRound).toBe(1);
    expect(startSubmitProposalSpy).toHaveBeenCalledOnce();
    expect(uiSocketService.notifySubmitProposal).toHaveBeenCalledWith(99, 1, 0, 1);

    // Prüfe ob sendMessage aufgerufen wurde
    expect(uiSocketService.sendMessage).toHaveBeenCalledWith({
      type: "submitProposal",
      groupId: 99,
      userId: 1,
      senderRoleId: 0,
      votingRound: 1
    });

    // Prüfe ob die Nachricht gesendet wurde
    const mockSocket = (uiSocketService as unknown as MockedUISocketService).__mockSocket;
    expect(mockSocket.send).toHaveBeenCalled();

    const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
    expect(sentMessage.type).toBe("submitProposal");
    expect(sentMessage.groupId).toBe(99);
    expect(sentMessage.senderRoleId).toBe(0);
  });

  it("ignoriert Click, wenn RoleId ≠ 0", async () => {
    const collab = await init(1); // normales Mitglied
    collab.startSubmitProposal();

    expect(collab.isVotingInProgress).toBe(false);
    expect(collab.currentVotingRound).toBe(0);
    expect(uiSocketService.notifySubmitProposal).not.toHaveBeenCalled();
  });
});
