// test/vitest/__tests__/stores/commentStore.spec.ts
import axios from "axios";
import { setActivePinia } from "pinia";
import { createTestingPinia } from "@pinia/testing";
import { vi, describe, it, expect, beforeEach, Mock } from "vitest";
import { useCommentStore } from "../../../../src/stores/commentStore";

// Mocken des gesamten axios-Moduls
vi.mock("axios");

// Erstellen eines Singleton-Stubs für den taskGraphStore
const taskGraphStub = {
  getProperty: vi.fn().mockReturnValue(5), // Standard-Rückgabewert für userId
  setProperty: vi.fn(),
};

// Mocken des Moduls, das den useTaskGraphStore-Hook exportiert
vi.mock("../../../../src/stores/taskGraphStore", () => ({
  useTaskGraphStore: () => taskGraphStub,
}));

describe("commentStore", () => {
  let store: ReturnType<typeof useCommentStore>;

  beforeEach(() => {
    // Erstellt für jeden Test eine neue, saubere Pinia-Instanz
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false });
    setActivePinia(pinia);
    store = useCommentStore();
    // Setzt alle Mocks vor jedem Test zurück
    vi.clearAllMocks();
  });

  it("initial state is empty and flags are false", () => {
    expect(store.availableSessions).toEqual([]);
    expect(store.isLoading).toBe(false);
    expect(store.error).toBeNull();
  });

  describe("actions", () => {
    it("fetchUserSessions stores backend data on success", async () => {
      const sessions = [
        { sessionId: 11, taskId: 2, timestamp: "", taskDescription: "", members: [] },
      ];
      (axios.get as Mock).mockResolvedValue({ data: sessions });

      await store.fetchUserSessions();

      expect(store.availableSessions).toEqual(sessions);
      expect(store.error).toBeNull();
      expect(store.isLoading).toBe(false);
    });

    it("fetchUserSessions sets error when userId is missing", async () => {
      taskGraphStub.getProperty.mockReturnValueOnce(null); // Simuliert einen nicht eingeloggten Benutzer
      await store.fetchUserSessions();
      expect(store.error).toBe("Benutzer-ID nicht verfügbar");
      expect(store.isLoading).toBe(false); // isLoading sollte auch bei Fehler zurückgesetzt werden
    });

    it("fetchUserSessions sets error on network failure", async () => {
      (axios.get as Mock).mockRejectedValue(new Error("Network Error"));
      await store.fetchUserSessions();
      expect(store.error).toBe("Fehler beim Laden der Daten");
      expect(store.isLoading).toBe(false);
    });

    it("validateSessionId distinguishes between 200 and 404", async () => {
      (axios.get as Mock).mockResolvedValueOnce({});
      expect(await store.validateSessionId(1)).toBe(true);
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      const err: any = new Error("404 Not Found");
      err.response = { status: 404 };
      (axios.get as Mock).mockRejectedValueOnce(err);
      expect(await store.validateSessionId(999)).toBe(false);
    });

    it("fetchCommentsForSession loads comments and triggers nickname loading", async () => {
      const comments = [
        { id: 1, sessionId: 7, fieldId: "a", userId: 42, text: "hi", timestamp: "" },
        { id: 2, sessionId: 7, fieldId: "b", userId: 55, text: "ho", timestamp: "" },
      ];
      (axios.get as Mock).mockResolvedValue({ data: comments });
      // Spionieren der internen Action, um die Logik zu überprüfen
      const spy = vi.spyOn(store, "loadNicknamesForUserIds").mockResolvedValue();

      await store.fetchCommentsForSession(7);

      expect(store.comments).toEqual(comments);
      // Stellt sicher, dass loadNicknamesForUserIds mit den einzigartigen User-IDs aufgerufen wird
      expect(spy).toHaveBeenCalledWith([42, 55]);
    });

    it("addComment sends a POST request and updates state", async () => {
      const newComment = { sessionId: 1, fieldId: "f1", userId: 5, text: "Neuer Kommentar" };
      const responseComment = { ...newComment, id: 123, timestamp: new Date().toISOString() };

      (axios.post as Mock).mockResolvedValue({ data: responseComment });

      await store.addComment(newComment);

      expect(axios.post).toHaveBeenCalledWith(
        `http://localhost:3000/api/v1/comments/`,
        expect.objectContaining(newComment)
      );
      expect(store.comments).toContainEqual(responseComment);
    });

    it("loadNicknamesForUserIds only fetches non-cached nicknames", async () => {
      // Vorbefüllen des Caches
      store.userNicknames = { 1: "Alice" };

      const getNicknamesSpy = vi.spyOn(store, "getMultipleUserNicknames").mockResolvedValue({ 2: "Bob" });

      await store.loadNicknamesForUserIds([1, 2]);

      // Es sollte nur die ID 2 abrufen, da 1 bereits im Cache ist
      expect(getNicknamesSpy).toHaveBeenCalledWith([2]);
      expect(store.userNicknames).toEqual({ 1: "Alice", 2: "Bob" });
    });
  });

  describe("getters", () => {
    beforeEach(() => {
      // Getter benötigen einen vordefinierten Zustand zum Testen
      store.availableSessions = [
        { sessionId: 1, taskId: 1, timestamp: "", taskDescription: "A", members: [{ userId: 10, roleId: 0, nickname: "Zehn"}] },
        { sessionId: 2, taskId: 1, timestamp: "", taskDescription: "B", members: [] },
      ];
      store.comments = [
        { id: 101, sessionId: 1, fieldId: "f1", userId: 10, text: "Hallo", timestamp: ""},
        { id: 102, sessionId: 1, fieldId: "f2", userId: 11, text: "Welt", timestamp: ""},
        { id: 103, sessionId: 2, fieldId: "f1", userId: 12, text: "Andere Session", timestamp: ""},
      ];
      store.userNicknames = { 10: "Zehn" };
    });

    it("currentSession returns the correct session by id", () => {
      store.currentSessionId = 1;
      expect(store.currentSession?.taskDescription).toBe("A");

      store.currentSessionId = 99; // nicht existierende ID
      expect(store.currentSession).toBeUndefined();
    });

    it("getMemberByRole returns correct userId or null", () => {
      expect(store.getMemberByRole(1, 0)).toBe(10);
      expect(store.getMemberByRole(1, 1)).toBeNull(); // Rolle nicht vorhanden
      expect(store.getMemberByRole(99, 0)).toBeNull(); // Session nicht vorhanden
    });

    it("commentsForField filters comments correctly", () => {
      store.currentSessionId = 1;
      const result = store.commentsForField("f1");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(101);
    });

    it("getNicknameByUserId returns nickname or a default string", () => {
      expect(store.getNicknameByUserId(10)).toBe("Zehn");
      expect(store.getNicknameByUserId(99)).toBe("User 99"); // Nicht im Cache
    });
  });
});
