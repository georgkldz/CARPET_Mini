// test/vitest/__tests__/stores/commentStore.spec.ts
import axios from "axios";
import { setActivePinia } from "pinia";
import { createTestingPinia } from "@pinia/testing";
import { vi, describe, it, expect, beforeEach, Mock } from "vitest";
import { useCommentStore } from "../../../../src/stores/commentStore";
// import { useTaskGraphStore } from "../../../../src/stores/taskGraphStore";

vi.mock("axios");

// EIN Singleton – egal über welchen Pfad importiert wird
const taskGraphStub = {
  getProperty: vi.fn().mockReturnValue(5), // userId 5
  setProperty: vi.fn(),
};

// relative Import des commentStore
vi.mock("../../../../src/stores/taskGraphStore", () => ({
  useTaskGraphStore: () => taskGraphStub,
}));

describe("commentStore", () => {
  let store: ReturnType<typeof useCommentStore>;

  beforeEach(() => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false });
    setActivePinia(pinia);
    store = useCommentStore();
    vi.clearAllMocks();
  });

  it("initial state is empty and flags are false", () => {
    expect(store.availableSessions).toEqual([]);
    expect(store.isLoading).toBe(false);
    expect(store.error).toBeNull();
  });

  it("fetchUserSessions stores backend data", async () => {
    const sessions = [
      { sessionId: 11, taskId: 2, timestamp: "", taskDescription: "", members: [] },
    ];
    (axios.get as unknown as Mock).mockResolvedValue({ data: sessions });

    await store.fetchUserSessions();

    expect(store.availableSessions).toEqual(sessions);          // ✅ jetzt grün
    expect(store.error).toBeNull();
  });

  it("fetchUserSessions sets error when userId missing", async () => {
    taskGraphStub.getProperty.mockReturnValueOnce(null); // simuliert Logout
    await store.fetchUserSessions();
    expect(store.error).toBe("Benutzer-ID nicht verfügbar");
  });

  it("validateSessionId unterscheidet 200 und 404", async () => {
    (axios.get as unknown as Mock).mockResolvedValueOnce({});
    expect(await store.validateSessionId(1)).toBe(true);
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    const err: any = new Error("404");
    err.response = { status: 404 };
    (axios.get as unknown as Mock).mockRejectedValueOnce(err);
    expect(await store.validateSessionId(999)).toBe(false);
  });

  it("fetchCommentsForSession lädt Kommentare und Nicknames", async () => {
    const comments = [
      { id: 1, sessionId: 7, fieldId: "a", userId: 42, text: "hi", timestamp: "" },
    ];
    (axios.get as unknown as Mock).mockResolvedValue({ data: comments });
    const spy = vi.spyOn(store, "loadNicknamesForUserIds").mockResolvedValue();

    await store.fetchCommentsForSession(7);

    expect(store.comments).toEqual(comments);
    expect(spy).toHaveBeenCalledWith([42]);
  });
});
