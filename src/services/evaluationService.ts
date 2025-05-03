// src/services/evaluationService.ts
import { useTaskGraphStore } from "stores/taskGraphStore";
import { useUserStore } from "stores/userStore";
import axios from "axios";
import type { Task } from "src/models/Task";

const EVALUATION_SERVER_URL = "http://localhost:5000/evaluate";

// Neue, umbenannte Funktion => postEvaluation
export async function postEvaluation(): Promise<void> {
  console.log("postEvaluation aufgerufen");
  const taskGraphStore = useTaskGraphStore();
  const userStore = useUserStore();

  // 1) Task-Daten aus dem taskGraphStore extrahieren
  const taskId = taskGraphStore.getCurrentTaskId;
  if (taskId === null) {
    throw new Error("Keine aktuelle Task-ID vorhanden");
  }

  // Metadaten
  const degree = taskGraphStore.getProperty("$.taskData.degree") as number;
  const symmetry = taskGraphStore.getProperty(
    "$.taskData.symmetry",
  ) as Task["symmetry"];

  // Lösungen (korrekte Felder aus DB)
  const textFieldEquation1 = taskGraphStore.getProperty(
    "$.taskData.solutions.textFieldEquation1",
  ) as string;
  const textFieldEquation2 = taskGraphStore.getProperty(
    "$.taskData.solutions.textFieldEquation2",
  ) as string;
  const textFieldEquation3 = taskGraphStore.getProperty(
    "$.taskData.solutions.textFieldEquation3",
  ) as string;
  const textFieldEquation4 = taskGraphStore.getProperty(
    "$.taskData.solutions.textFieldEquation4",
  ) as string;
  const textFieldEquation5 = taskGraphStore.getProperty(
    "$.taskData.solutions.textFieldEquation5",
  ) as string;

  // **Keine filter(Boolean)** => Leere Strings bleiben drin
  const correctTexts = [
    textFieldEquation1 ?? "",
    textFieldEquation2 ?? "",
    textFieldEquation3 ?? "",
    textFieldEquation4 ?? "",
    textFieldEquation5 ?? "",
  ];

  // 2) Nutzereingaben extrahieren (5 Felder, teils leer)
  const latexInput1 =
    (taskGraphStore.getProperty(
      "$.nodes.0.components.0.nestedComponents.formComponents.latexInputField1.state.fieldValue",
    ) as string) ?? "";
  const latexInput2 =
    (taskGraphStore.getProperty(
      "$.nodes.0.components.0.nestedComponents.formComponents.latexInputField2.state.fieldValue",
    ) as string) ?? "";
  const latexInput3 =
    (taskGraphStore.getProperty(
      "$.nodes.0.components.0.nestedComponents.formComponents.latexInputField3.state.fieldValue",
    ) as string) ?? "";

  const textInput1 =
    (taskGraphStore.getProperty(
      "$.nodes.0.components.0.nestedComponents.formComponents.inputField1.state.fieldValue",
    ) as string) ?? "";
  const textInput2 =
    (taskGraphStore.getProperty(
      "$.nodes.0.components.0.nestedComponents.formComponents.inputField2.state.fieldValue",
    ) as string) ?? "";
  const textInput3 =
    (taskGraphStore.getProperty(
      "$.nodes.0.components.0.nestedComponents.formComponents.inputField3.state.fieldValue",
    ) as string) ?? "";
  const textInput4 =
    (taskGraphStore.getProperty(
      "$.nodes.0.components.0.nestedComponents.formComponents.inputField4.state.fieldValue",
    ) as string) ?? "";
  const textInput5 =
    (taskGraphStore.getProperty(
      "$.nodes.0.components.0.nestedComponents.formComponents.inputField5.state.fieldValue",
    ) as string) ?? "";

  // textInputs => immer 5 Felder, ggf. leer
  const textInputs = [
    textInput1,
    textInput2,
    textInput3,
    textInput4,
    textInput5,
  ];

  // 3) Payload für Server
  const payload = {
    degree,
    symmetry,
    user_f: latexInput1,
    user_fprime: latexInput2,
    user_fprime2: latexInput3,
    textInputs, // immer length=5
    correctTexts, // length = 5, leere Strings bleiben drin
  };

  try {
    console.log("Sende Daten zur Evaluation:", payload);
    const { data } = await axios.post<{ score: number }>(
      EVALUATION_SERVER_URL,
      payload,
    );
    console.log("Evaluation erfolgreich, Score:", data.score);

    // 4) Leistungsvermögen speichern
    userStore.setProficiency({
      taskId,
      score: data.score,
    });
  } catch (error) {
    console.error("Fehler bei der Evaluation:", error);
    throw error;
  }
}
