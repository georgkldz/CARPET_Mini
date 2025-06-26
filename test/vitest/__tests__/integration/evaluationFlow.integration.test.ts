import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestingPinia } from "@pinia/testing";
import { setActivePinia } from "pinia";
import axios from "axios";
import { useTaskGraphStore} from "../../../../src/stores/taskGraphStore";
import { useUserStore} from "../../../../src/stores/userStore";
import { postEvaluation} from "../../../../src/services/evaluationService";

vi.mock("axios", () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { score: 6 }}),
  },
}));

// Helper: Initialisiere Stores vor jedem Test
function initStores() {
  setActivePinia(
    createTestingPinia({
      stubActions: false,
      createSpy: vi.fn,
    }),
  );
  const task = useTaskGraphStore();
  const user = useUserStore();

  // Minimales State-Setup
  task.setProperty({ path: "$.taskData.degree", value: 3 });
  task.setProperty({ path: "$.taskData.symmetry", value: "even" });
  task.setProperty({ path: "$.taskData.solutions.textFieldEquation1", value: "x^2" });
  task.setCurrentTask("Steckbriefaufgabe");
  task.setProperty({ path: "$.taskData.taskId", value: 42 });
  user.currentUser = { userId: 1, email: "demo@mail.com", role: 0 };
  return { task, user };
}

describe("Evaluation-Flow", () => {
  beforeEach(initStores);
  it("speichert Proficiency nach postEvaluation", async () => {
    await postEvaluation();
    expect(axios.post).toHaveBeenCalledOnce();
    const user = useUserStore();
    expect(user.getProficiencyByTaskId(42)).toBe(6);
  });
});
