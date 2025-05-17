import { defineStore } from "pinia";
import type { StateTree } from "pinia";
import { useApplicationStore } from "./applicationStore";
import type { AvailableTasks } from "./applicationStore";
import type { SerialisedTask } from "./applicationStore";
import { JSONPath } from "jsonpath-plus";
import { syncSingleComponentChange, SUBMIT_PROPOSAL_PATH } from "stores/sync/automergeSync";
import type { Task } from "src/models/Task";

import type {
  StoreAPI,
  JSONPathExpression,
  StoreSetterPayload,
} from "carpet-component-library";
//import { useAuthStore } from "stores/authStore";
import { useTasksStore } from "stores/tasksStore";
import { nextTick } from "vue";
import { useCollaborationStore } from "stores/collaborationStore";

export interface EventLog {
  interactionEvents: Array<object>;
  mouseEvents: Array<object>;
  panningEvents: Array<object>;
  zoomingEvents: Array<object>;
  metaData: object;
}

export interface CARPETStoreAPI extends StoreAPI {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface TaskGraphState extends SerialisedTask {
  applyingRemote: boolean;
  isPromotingToCollab: boolean;
  userId: number | undefined;
  myCollabRoleId: number | undefined;
  submitProposal?: Record<number, "pending" | "accepted" | "rejected">;
  currentTask: string | null;
  isLoading: boolean;
  currentNode: number | null;
  previousNode: number | null;
  replayLog: EventLog;
}

export type TaskGraphStateKey = keyof TaskGraphState;

/**
 * The taskGraphStore has to be defined with the Options-API,
 * as `this.$state` is not available for actions in the Setup-API.
 */
export const useTaskGraphStore = defineStore("taskGraphStore", {
  state: (): TaskGraphState => ({
    userId: undefined,
    myCollabRoleId: undefined,
    submitProposal: undefined,
    currentTask: null,
    isLoading: false,
    currentNode: null,
    previousNode: null,
    applyingRemote: false,
    isPromotingToCollab: false,
    taskData: {},
    replayLog: {
      interactionEvents: [],
      mouseEvents: [],
      panningEvents: [],
      zoomingEvents: [],
      metaData: {},
    },
    feedbackLevel: "none",
    layoutSize: "desktop",
    rootNode: 0,
    nodes: {},
    edges: {},
  }),
  getters: {
    getPropertyFromPath: (state) => (path: JSONPathExpression) => {
      if (typeof path !== "string") {
        throw new Error(`Path is not a string: ${path}`);
      }
      const result = JSONPath({ path: path, json: state });
      if (result.length === 1) return result[0];
      return result;
    },
    getCurrentNode: (state) => {
      return state.nodes[state.currentNode as number];
    },

    getCurrentCollaborationMode: (
      state: TaskGraphState,
    ): "single" | "groupBuilding" | "collaboration" => {
      if (state.currentNode === null) return "single";
      return state.nodes[state.currentNode]?.collaboration?.mode ?? "single";
    },
    // Ruft den Getter aus dem authStore auf, der die ID der aktuellen Aufgabe liefert
    getCurrentTaskId(): number | null {
      const tasksStore = useTasksStore();
      return tasksStore.getCurrentTaskId;
    },
  },

  actions: {
    /**
     * Extra-Action, um den Task aus der DB (bzw. tasksStore) zu laden
     * und bestimmte Felder in das JSON des SerialisedTask zu schreiben
     * (z.B. description, hint, etc.).
     */
    loadDBTaskIntoGraph() {
      console.log("loadDBTaskIntoGraph gestartet");
      // 1. Task-ID holen
      const taskId = this.getCurrentTaskId;
      if (!taskId) {
        console.warn("Keine aktuelle Task-ID definiert.");
        return;
      }
      console.log("currentTaskId ist ", taskId);
      // 2. tasksStore importieren + Task finden
      const tasksStore = useTasksStore();
      const foundTask: Task | undefined = tasksStore.getTaskById(taskId);
      if (!foundTask) {
        console.warn(`Task mit ID=${taskId} nicht im tasksStore gefunden.`);
        return;
      }

      // 3. Gewünschte Felder in den "taskGraphState" schreiben,
      //    z. B. an JSON-Pfade für description/hint
      //  (Passe diese Pfade an deine JSON-Struktur an!)
      this.setProperty({
        path: "$.nodes.0.components.0.nestedComponents.formComponents.textView1.state.textSegments[0].text",
        value: foundTask.description,
      });
      this.setProperty({
        path: "$.nodes.2.components.0.nestedComponents.formComponents.textView1.state.textSegments[0].text",
        value: foundTask.description,
      });
      this.setProperty({
        path: "$.nodes.3.components.5.nestedComponents.formComponents.textView1.state.textSegments[0].text",
        value: foundTask.description,
      });
      this.setProperty({
        path: "$.taskData.taskDescription",
        value: foundTask.description,
      });
      this.setProperty({
        path: "$.taskData.hint",
        value: foundTask.hint ?? "",
      });
      // Im loadDBTaskIntoGraph():
      this.setProperty({
        path: "$.taskData.degree",
        value: foundTask.degree,
      });
      this.setProperty({
        path: "$.taskData.symmetry",
        value: foundTask.symmetry,
      });
      this.setProperty({
        path: "$.taskData.solutions.textFieldEquation1",
        value: foundTask.solutions?.textFieldEquation1 ?? "",
      });
      this.setProperty({
        path: "$.taskData.solutions.textFieldEquation2",
        value: foundTask.solutions?.textFieldEquation2 ?? "",
      });
      this.setProperty({
        path: "$.taskData.solutions.textFieldEquation3",
        value: foundTask.solutions?.textFieldEquation3 ?? "",
      });
      this.setProperty({
        path: "$.taskData.solutions.textFieldEquation4",
        value: foundTask.solutions?.textFieldEquation4 ?? "",
      });
      this.setProperty({
        path: "$.taskData.solutions.textFieldEquation5",
        value: foundTask.solutions?.textFieldEquation5 ?? "",
      });
      this.setProperty({
        path: "$.taskData.solutions.sampleSolutionCollaborativeWork",
        value: foundTask.solutions?.sampleSolutionCollaborativeWork ?? "",
      });

      // Ggf. weitere Felder
      console.log("loadDBTaskIntoGraph: Task übernommen:", foundTask);
    },


    async extractFieldValues() {
      while (!this.getProperty("$.documentReady")) {
        await nextTick()
      }

      const myRoleId  = useCollaborationStore().myCollabRoleId ?? 0;
      console.debug("extractFieldvalues lädt aus collabStore roleId ", myRoleId);
      const srcBase = "$.nodes.0.components.0.nestedComponents.formComponents";
      const dstBase = "$.nodes.2.components.0.nestedComponents.formComponents";

      // alle Feld-IDs der Steckbrief-Aufgabe
      const fields = [
        "latexInputField1",
        "latexInputField2",
        "latexInputField3",
        "inputField1",
        "inputField2",
        "inputField3",
        "inputField4",
      ];

      fields.forEach((fid) => {
        const srcPath = `${srcBase}.${fid}.state.fieldValue` as JSONPathExpression;
        const val = this.getProperty(srcPath);

        if (val === undefined) return;

        const compId = `r${myRoleId}_${fid}`;
        console.debug("taskGraphStore, extractFieldValues schreibt " + `${dstBase}.${compId}.state.fieldValue`, val);
        this.setProperty({
          path: `${dstBase}.${compId}.state.fieldValue`,
          value: val,
        });
      });
    },

    setCurrentTask(taskName: string) {
      this.currentTask = taskName;
    },
    setRemoteProperty(payload: StoreSetterPayload) {
      this.applyingRemote = true;
      this.setProperty(payload);
      this.applyingRemote = false;
    },
    setProperty(payload: StoreSetterPayload) {
      // const applicationStore = useApplicationStore();
      const { path, value } = payload;
      const splitPath = JSONPath.toPathArray(path).slice(1);
      let subState = this.$state as StateTree;
      for (let depth = 0; depth < splitPath.length; depth++) {
        if (depth === splitPath.length - 1) {
          // only update the value if it is different
          if (subState[splitPath[depth]] != value) {
            subState[splitPath[depth]] = value;

            // Log the state change in the replayLog
            this.replayLog.interactionEvents.push(payload);

            /**
             * Log the state change in development mode.
             */
            process.env.NODE_ENV === "development" && console.log(path, value);
          }
        } else {
          if (subState[splitPath[depth]] === undefined) {
            subState[splitPath[depth]] = {};
          }
          subState = subState[splitPath[depth]];
        }
      }
      // optional Logging
      process.env.NODE_ENV === "development" && console.log(path, value);
      if (path.endsWith(".fieldValue") || path.includes(".fieldValueByUser.")||
        path.startsWith(SUBMIT_PROPOSAL_PATH) ) {
        const mode = this.getCurrentCollaborationMode;
        if ((mode === "collaboration"&& !this.applyingRemote) || this.isPromotingToCollab)  {
          console.debug("taskGraphStore, setProperty → syncSingleComponentChange", path, value);
          syncSingleComponentChange(path, value, this.userId);
        }
      }
    },
    /**
     * Required helper functions, as it is not possible to define getters that receive arguments.
     * This is due to getters being simply computed properties.
     * By returning a function from a getter, we can achieve the same functionality, but at the cost of not being able to cache the computed properties.
     * See https://pinia.vuejs.org/core-concepts/getters.html#Passing-arguments-to-getters.
     * @param path JSONPathExpression
     * @returns ComputedRef<any>
     */
    getProperty(path: JSONPathExpression) {
      return this.getPropertyFromPath(path);
    },
    fetchTaskGraph() {
      const applicationStore = useApplicationStore();
      const tasks = applicationStore.tasks;
      const currentTask = tasks[this.currentTask as AvailableTasks];
      if (currentTask) {
        // übernimm "Example.carpet.json" in den State
        for (const [key, value] of Object.entries(currentTask)) {
          this.setProperty({ path: `$.${key}`, value });
        }
        this.setProperty({
          path: "$.currentNode",
          value: currentTask.rootNode,
        });
      }
      // Ruft nun unsere neue Action auf,
      // um einen DB-Task (basierend auf authStore.currentTaskId) einzubinden:
      this.loadDBTaskIntoGraph();
    },

    async submitForEvaluation() {
      try {
        const { postEvaluation } = await import(
          "../services/evaluationService"
        );
        console.debug("taskGraphStore ruft evaluationservice auf")
        await postEvaluation();
        return true;
      } catch (error) {
        console.error("Fehler bei der Einreichung der Bewertung:", error);
        return false;
      }
    },

    trackMouse(mouseEvent: { x: number; y: number; timestamp: number }) {
      this.replayLog.mouseEvents.push(mouseEvent);
    },

    toggleLoading() {
      this.isLoading = !this.isLoading;
    },
  },
});
