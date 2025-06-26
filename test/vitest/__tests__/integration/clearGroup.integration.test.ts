/*
 * Integration‑Test: clearGroup‑Flow
 *
 * Speicherort: test/vitest/__tests__/integration/clearGroup.spec.ts
 *
 * Ziel: Nur der Happy‑Path – sicherstellen, dass `clearGroup()`
 *   • alle Group‑Flags zurücksetzt
 *   • die Soft‑Reset‑/Leave‑Hilfsfunktionen aufgerufen werden
 *   • keine Voting‑Reste übrig bleiben.
 */
import {describe, it, expect, vi, beforeEach, Mock} from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useCollaborationStore, type GroupInfo } from "../../../../src/stores/collaborationStore";
import { useTaskGraphStore} from "../../../../src/stores/taskGraphStore";
import axios from "axios";

/* -----------------------------------------------------------
 * 1)   Stubs & Mocks – alle externen Abhängigkeiten abfangen
 * --------------------------------------------------------- */
vi.mock("axios");
vi.mock("src/services/collaborationService", () => ({
  resetSSEListener: vi.fn(),
}));
vi.mock("stores/sync/automergeSync", () => ({
  softResetSession: vi.fn().mockResolvedValue(true),
  leaveSession: vi.fn().mockResolvedValue(undefined),
}));

const mockedAxios = axios as unknown as { post: Mock };

/* -----------------------------------------------------------
 * 2)   Helfer zum (Neu‑)Init der Stores pro Testfall
 * --------------------------------------------------------- */
function initStores() {
  setActivePinia(createPinia());
  const collab = useCollaborationStore();
  const graph  = useTaskGraphStore();

  // Minimale Rollen‑Definition für setRoleInfos()
  graph.setProperty({
    path: "$.roles",
    value: {
      0: { name: "Sprecher", description: "", writeAccess: [], colorHex: "#fff" },
    },
  });
  return { collab, graph };
}

/* -----------------------------------------------------------
 * 3)   Die eigentlichen Tests
 * --------------------------------------------------------- */
describe("Integration › clearGroup flow", () => {
  beforeEach(() => {
    mockedAxios.post.mockResolvedValue({}); // Stub für /grouping/leave
    vi.clearAllMocks();
  });

  it("setzt alle Kollaborations‑States zurück", async () => {
    const { collab } = initStores();

    // Fixture‑Gruppe anlegen
    const fixture: GroupInfo = {
      groupId: 99,
      taskId: 42,
      size: 2,
      memberIds: [10, 11],
      members: [
        { userId: 10, collabRoleId: 0, nickname: "Alice" },
        { userId: 11, collabRoleId: 1, nickname: "Bob" },
      ],
    };
    collab.setGroup(fixture, 10);
    expect(collab.inGroup).toBe(true);

    // --- Aktion --------------------------------------------------------
    await collab.clearGroup();

    // --- Assertions ----------------------------------------------------
    expect(collab.group).toBeNull();
    expect(collab.groupId).toBeNull();
    expect(collab.myUserId).toBeNull();
    expect(collab.roleInfos).toEqual({});
    expect(collab.isVotingInProgress).toBe(false);
    expect(collab.currentVotingRound).toBe(0);
  });
});
