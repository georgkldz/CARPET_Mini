import { defineStore } from "pinia";
import type { StateTree } from "pinia";
import { useApplicationStore } from "./applicationStore";
import type { AvailableTasks } from "./applicationStore";
import type { SerialisedTask } from "./applicationStore";
import { JSONPath } from "jsonpath-plus";
import { syncSingleComponentChange } from "stores/sync/automergeSync";
import type { Task } from "src/models/Task";

import type {
  StoreAPI,
  JSONPathExpression,
  StoreSetterPayload,
} from "carpet-component-library";
import { useAuthStore } from "stores/authStore";
import { useTasksStore } from "stores/tasksStore";

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
    currentTask: null,
    isLoading: false,
    currentNode: null,
    previousNode: null,
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

    // Ruft den Getter aus dem authStore auf, der die ID der aktuellen Aufgabe liefert
    getCurrentTaskId(): number | null {
      const authStore = useAuthStore();
      return authStore.getCurrentTaskId;
    },
  },
  actions: {
    /**
     * Extra-Action, um den Task aus der DB (bzw. tasksStore) zu laden
     * und bestimmte Felder in das JSON des SerialisedTask zu schreiben
     * (z.B. description, hint, etc.).
     */
    loadDBTaskIntoGraph() {
      // 1. Task-ID holen
      const taskId = this.getCurrentTaskId;
      if (!taskId) {
        console.warn("Keine aktuelle Task-ID definiert.");
        return;
      }

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
        value: foundTask.textFieldEquation1 ?? "",
      });
      this.setProperty({
        path: "$.taskData.solutions.sampleSolutionCollaborativeWork",
        value: foundTask.sampleSolutionCollaborativeWork ?? "",
      });

      // Ggf. weitere Felder
      console.log("loadDBTaskIntoGraph: Task übernommen:", foundTask);
    },
// Dies ersetzt die alte extractComponentData()-Methode
    extractFieldValues() {
      // JSONPath durchsucht alles nach "fieldValue"
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      const results = JSONPath<Array<{ path: string | (string | number)[]; value: any }>>({
        path: "$..fieldValue",
        json: this.$state,
        resultType: "all",
      });

      // Verarbeite die Ergebnisse und normalisiere die Pfade
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      return results.map(({ path, value }: { path: string | (string | number)[]; value: any }) => {
        // Pfad normalisieren - kann je nach JSONPath-Implementierung ein String oder Array sein
        let normalizedPath: string;

        if (typeof path === "string") {
          // Wenn path bereits ein String ist, verwenden wir ihn direkt
          normalizedPath = path;
        } else if (Array.isArray(path)) {
          // Wenn path ein Array ist, konvertieren wir es wie zuvor
          normalizedPath = "$" + path
            .slice(1)
            .map(segment => "." + segment)
            .join("");
        } else {
          // Fallback für unerwartete Typen
          console.error("Unerwarteter Pfadtyp in extractFieldValues:", path);
          normalizedPath = String(path); // Versuch einer Konvertierung
        }

        return {
          path: normalizedPath,
          value,
        };
      });
    },

    extractComponentData() {
      const componentsPath = "$.nodes.0.components";
      const components = JSONPath({ path: componentsPath, json: this.$state });

      if (!components || !components[0]) {
        console.warn("Keine Komponenten gefunden unter", componentsPath);
        return [];
      }
      return Object.entries(components[0]).map(([id, data]) => ({
        id: Number(id),
        data,
      }));
    },

    setCurrentTask(taskName: string) {
      this.currentTask = taskName;
    },
    setProperty(payload: StoreSetterPayload) {
      const applicationStore = useApplicationStore();
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
          subState = subState[splitPath[depth]];
        }
      }
      // optional Logging
      process.env.NODE_ENV === "development" && console.log(path, value);
      if (
        !applicationStore.isRemoteUpdate &&
        path.endsWith(".fieldValue")
      ) {
        console.log(
          "setProperty ruft syncSinglePathValue auf mit ",
          path,
          value,
        );
        syncSingleComponentChange(path, value);
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

    trackMouse(mouseEvent: { x: number; y: number; timestamp: number }) {
      this.replayLog.mouseEvents.push(mouseEvent);
    },

    toggleLoading() {
      this.isLoading = !this.isLoading;
    },

    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    applySynchronizedChanges(changes: { id: number; data: any }[]) {
      console.log("applySynchronizedChanges aufgerufen", changes);
      changes.forEach(({ id, data }) => {
        // Bestehende Komponente aktualisieren
        this.$state.nodes[0].components[id] = data;
      });
    },
  },
});
