import axios from "axios";
import { setActivePinia } from "pinia";
import { createTestingPinia } from "@pinia/testing";
import { vi, describe, it, expect, beforeEach, Mock } from "vitest";
import { useUserStore, Proficiency } from "../../../../src/stores/userStore";
import { useTaskGraphStore } from "../../../../src/stores/taskGraphStore";

vi.mock("axios");
vi.mock("stores/taskGraphStore", () => ({
  useTaskGraphStore: vi.fn(() => ({ setProperty: vi.fn() })),
}));

describe("userStore", () => {
  let userStore: ReturnType<typeof useUserStore>;

  beforeEach(() => {
    // 1️⃣ Test-Pinia anlegen …
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      stubActions: false,   // login soll wirklich laufen
    });

    // 2️⃣ … als aktive Pinia registrieren
    setActivePinia(pinia);

    // 3️⃣ Store-Instanz holen
    userStore = useUserStore();
  });

  it("initial state is correct", () => {
    expect(userStore.currentUser).toBeNull();
    expect(userStore.isAuthenticated).toBe(false);
    expect(userStore.loading).toBe(false);
    expect(userStore.errorMessage).toBeNull();
    expect(userStore.proficiencies).toEqual([]);
  });

  it("getter userId and roleId", () => {
    userStore.currentUser = { userId: 42, email: "a@b.c", password: "", role: 7 };
    expect(userStore.userId).toBe(42);
    expect(userStore.roleId).toBe(7);
  });

  it("getProficiencyByTaskId returns correct score or null", () => {
    userStore.proficiencies = [{ taskId: 1, score: 5 }, { taskId: 2, score: 8 }];
    expect(userStore.getProficiencyByTaskId(1)).toBe(5);
    expect(userStore.getProficiencyByTaskId(3)).toBeNull();
  });

  it("login success sets user and calls taskGraph", async () => {
    (axios.post as unknown as Mock).mockResolvedValue({
      data: { userId: 13, role: 2 },
    });

    await userStore.login("foo@bar", "pw");

    /* derselbe Stub aus setup-file.ts */
    const taskGraph = useTaskGraphStore();
    expect(taskGraph.setProperty).toHaveBeenCalledWith({
      path: "$.userId",
      value: 13,
    });
  });

  it("login failure sets errorMessage", async () => {
    (axios.post as unknown as Mock).mockRejectedValue(new Error("err"));

    await userStore.login("x@y.z", "pw");

    expect(userStore.loading).toBe(false);
    expect(userStore.isAuthenticated).toBe(false);
    expect(userStore.errorMessage).toBe("Login fehlgeschlagen.");
  });

  it("logout resets state", () => {
    userStore.currentUser = { userId: 1, email: "", password: "", role: 1 };
    userStore.isAuthenticated = true;
    userStore.loading = true;
    userStore.errorMessage = "oops";

    userStore.logout();

    expect(userStore.currentUser).toBeNull();
    expect(userStore.isAuthenticated).toBe(false);
    expect(userStore.loading).toBe(false);
    expect(userStore.errorMessage).toBeNull();
  });

  it("setProficiency adds or updates entry", () => {
    const prof: Proficiency = { taskId: 9, score: 6 };
    userStore.setProficiency(prof);
    expect(userStore.proficiencies).toContainEqual(prof);

    const updated: Proficiency = { taskId: 9, score: 8 };
    userStore.setProficiency(updated);
    expect(userStore.proficiencies.find(p => p.taskId === 9)?.score).toBe(8);
  });
});
