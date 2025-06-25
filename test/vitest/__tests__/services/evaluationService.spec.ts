// test/vitest/__tests__/services/evaluationService.spec.ts
import axios from "axios";
import { vi, describe, it, expect, beforeEach, Mock } from "vitest";
import { setActivePinia } from "pinia";
import { createTestingPinia } from "@pinia/testing";

/* -------- Pinia sofort aktivieren, damit Stores initialisierbar sind ---- */
const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false });
setActivePinia(pinia);

/* -------- Axios global stubben ----------------------------------------- */
vi.mock("axios");

/* -------- Testdaten ----------------------------------------------------- */
const graphData = {
  taskId: 42,
  degree: 3,
  symmetry: "even" as const,
  correctTexts: ["a", "b", "c", "d", "e"],
  latex: ["L1", "L2", "L3"] as const,
  text: ["T1", "T2", "T3", "T4", "T5"] as const,
};

/* -------- TaskGraph-Store Stub ----------------------------------------- */
function makeTaskGraphStub() {
  return {
    getCurrentTaskId: graphData.taskId,
    getProperty(path: string) {
      if (path.includes("taskData.degree")) return graphData.degree;
      if (path.includes("taskData.symmetry")) return graphData.symmetry;
      if (path.includes("solutions.textFieldEquation1")) return graphData.correctTexts[0];
      if (path.includes("solutions.textFieldEquation2")) return graphData.correctTexts[1];
      if (path.includes("solutions.textFieldEquation3")) return graphData.correctTexts[2];
      if (path.includes("solutions.textFieldEquation4")) return graphData.correctTexts[3];
      if (path.includes("solutions.textFieldEquation5")) return graphData.correctTexts[4];

      /* Latex-Felder */
      if (path.includes("latexInputField1")) return graphData.latex[0];
      if (path.includes("latexInputField2")) return graphData.latex[1];
      if (path.includes("latexInputField3")) return graphData.latex[2];

      /* Text-Inputs 1-5 */
      if (path.endsWith("inputField1.state.fieldValue")) return graphData.text[0];
      if (path.endsWith("inputField2.state.fieldValue")) return graphData.text[1];
      if (path.endsWith("inputField3.state.fieldValue")) return graphData.text[2];
      if (path.endsWith("inputField4.state.fieldValue")) return graphData.text[3];
      if (path.endsWith("inputField5.state.fieldValue")) return graphData.text[4];

      return undefined;
    },
  };
}
const taskGraphStub = makeTaskGraphStub();

vi.mock("stores/taskGraphStore", () => ({
  __esModule: true,
  useTaskGraphStore: () => taskGraphStub,
}));

vi.mock("../../../../src/stores/taskGraphStore", () => ({
  __esModule: true,
  useTaskGraphStore: () => taskGraphStub,
}));

/* -------- User-Store Stub ---------------------------------------------- */
const setProficiency = vi.fn();
function mockUserStore() {
  return {
    __esModule: true,
    useUserStore: () => ({ setProficiency }),
  };
}

/* ---------- 3.  Beide Pfade mocken --------------------------- */
vi.mock("stores/userStore", mockUserStore);
vi.mock("../../../../src/stores/userStore", mockUserStore);

/* -------- Service erst NACH den Mocks importieren ---------------------- */
import { postEvaluation } from "../../../../src/services/evaluationService";

/* -------- Erwartete Payload zum Vergleich ------------------------------ */
const expectedPayload = {
  degree: graphData.degree,
  symmetry: graphData.symmetry,
  user_f: graphData.latex[0],
  user_fprime: graphData.latex[1],
  user_fprime2: graphData.latex[2],
  textInputs: [...graphData.text],
  correctTexts: [...graphData.correctTexts],
};
const URL = "http://localhost:5000/evaluate";

/* -------- Tests -------------------------------------------------------- */
describe("evaluationService.postEvaluation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // für den Fehler-Test später den taskId-Wert zurücksetzen
    taskGraphStub.getCurrentTaskId = graphData.taskId;
  });

  it("schickt korrekte Daten an den Evaluation-Server und speichert Score", async () => {
    (axios.post as unknown as Mock).mockResolvedValue({ data: { score: 7 } });

    await postEvaluation();

    expect(axios.post).toHaveBeenCalledWith(URL, expectedPayload);
    expect(setProficiency).toHaveBeenCalledWith({ taskId: 42, score: 7 });
  });

  it("wirft Fehler, falls keine Task-ID vorhanden ist", async () => {
    taskGraphStub.getCurrentTaskId = null;

    await expect(postEvaluation()).rejects.toThrow("Keine aktuelle Task-ID vorhanden");
  });
});
