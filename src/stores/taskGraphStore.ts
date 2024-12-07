import { defineStore } from "pinia";
import type { StateTree } from "pinia";
import { useApplicationStore } from "./applicationStore";
import type { AvailableTasks } from "./applicationStore";
import type { SerialisedTask } from "./applicationStore";
import { JSONPath } from "jsonpath-plus";
import { DocHandle, AnyDocumentId } from "@automerge/automerge-repo/slim";
import {initializeRepo } from "../utils/repo.ts";

// URL zur WebAssembly-Binary mit ?url laden
import wasmUrl from "@automerge/automerge/automerge.wasm?url";
// Slim-Varianten von Automerge und Automerge-Repo verwenden
import { next as Automerge } from "@automerge/automerge/slim";

(async () => {
    // WebAssembly-Modul initialisieren
    await Automerge.initializeWasm(wasmUrl);
})();


import type {
  StoreAPI,
  JSONPathExpression,
  StoreSetterPayload,
} from "carpet-component-library";

// Konstant für die Session-ID
const SESSION_ID = 43;

// Server-Endpunkt
const SERVER_URL = "http://localhost:3000"; // Passe die URL an deinen Server an

// TODO: Specify the types of the event objects
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
  documentId: AnyDocumentId | null; // Hinzugefügt: Speichert die documentId
  handle:  DocHandle<{ taskGraph: Record<string, unknown> }> | null;
  sessionInitialized: boolean;
}

export type TaskGraphStateKey = keyof TaskGraphState;


/**
 * The taskGraphStore has to be defined with the Options-API, as `this.$state` is not available for actions in the Setup-API.
 * Acces to `this.$state` is required to manipulate the store state via `setProperty` from any component.
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
    documentId: null, // Initialwert für documentId
    handle: null as DocHandle<{ taskGraph: Record<string, unknown> }> | null,
    sessionInitialized: false,
  }),
  getters: {

    getPropertyFromPath: (state) => (path: JSONPathExpression) => {
      if (typeof path !== "string") {
        throw new Error(`Path is not a string: ${path}`);
      }
      const result = JSONPath({ path: path, json: state });
      if (result.length === 1) return result[0];
      else return result;
    },
    getCurrentNode: (state) => {
      return state.nodes[state.currentNode as number];
    },
  },
  actions: {
    setCurrentTask(taskName: string) {
      console.log("setCurrentTask betreten");
      this.currentTask = taskName;
    },
      // Synchronisiere Änderungen von Automerge ins Store
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  syncFromDoc(doc: any) {
    if (!doc.taskGraph) return;

    for (const [key, value] of Object.entries(doc.taskGraph)) {
      this.setProperty({ path: `$.${key}`, value });
    }
  },
    syncToDoc() {
      console.log("syncToDoc wird aufgerufen. Handle verfügbar:", this.handle?.isReady);
      console.log(this.handle?.documentId);
      if (!this.handle?.isReady) {
        console.warn(
          "No handle available for syncing. Stelle sicher, dass loadDocument erfolgreich abgeschlossen ist."
        );
        return;
      }

      this.handle.change((doc) => {
        console.log("handle.change wird aufgerufen");
        if (!doc.taskGraph) {
          doc.taskGraph = {};
        }

        // Synchronisiere alle Schlüssel aus dem Store
        for (const [key, value] of Object.entries(this.$state)) {
          // Nur aktualisieren, wenn der Wert unterschiedlich ist
          if (doc.taskGraph[key] !== value) {
            console.log(`Synchronisiere Schlüssel: ${key}, Neuer Wert:`, value);
            doc.taskGraph[key] = value;
          }
        }
        console.log("Dokument nun "+doc.taskGraph);
      });
    },


    setProperty(payload: StoreSetterPayload) {
      const { path, value } = payload;
      const splitPath = JSONPath.toPathArray(path).slice(1);
      let subState = this.$state as StateTree;
      let changed = false;
      for (let depth = 0; depth < splitPath.length; depth++) {
        if (depth === splitPath.length - 1) {
          // only update the value if it is different
          if (subState[splitPath[depth]] != value) {
            subState[splitPath[depth]] = value;
            changed = true;
          }
        } else {
          subState = subState[splitPath[depth]];
        }
      }

      /**
       * Log the state change in development mode.
       */
      process.env.NODE_ENV === "development" && console.log(path, value);
      console.log("setProperty wurde ausgeführt. Versuche Automerge")
        if (changed && this.handle?.isReady) {
          console.log("syncToDoc wird aufgerufen");
        this.syncToDoc();
      } else {
        console.warn("Handle ist nicht initialisiert. Synchronisierung wird übersprungen.");
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
      console.log("fetchTaskGraph betreten");
      const applicationStore = useApplicationStore();
      const tasks = applicationStore.tasks;
      const currentTask = tasks[this.currentTask as AvailableTasks];
      /**
       * Set properites of currentTask via setProperty to include them in the EventLog.
       */
      for (const [key, value] of Object.entries(currentTask)) {
        this.setProperty({ path: `$.${key}`, value: value });
      }
      this.setProperty({ path: "$.currentNode", value: currentTask.rootNode });
    },

    trackMouse(mouseEvent: { x: number; y: number; timestamp: number }) {
      this.replayLog.mouseEvents.push(mouseEvent);
    },

    toggleLoading() {
      this.isLoading = !this.isLoading;
    },

    async joinSession() {
      console.log("Methode joinSession betreten");
      if (this.sessionInitialized) {
        console.log("Session already initialized.");
        return;
      }

      try {
        const response = await fetch(`${SERVER_URL}/joinSession`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId: SESSION_ID }),
        });

        if (!response.ok) {
          throw new Error("Failed to join session");
        }
        const data = await response.json();
        this.documentId = data.documentUrl;
        console.log("joinSession hat vom Server DocumentId erhalten:", this.documentId);
      } catch (error) {
        console.error("Error joining session:", error);
      }
      console.log("Methode loadDocument betreten")
      if (!this.documentId) {
        console.error("Document ID is missing.");
        return;
      }

      const repo = await initializeRepo();
      console.log("Repo für loadDocument erhalten:", repo);
      console.log("Lade Dokument mit ID:", this.documentId);
      this.handle = repo.find(this.documentId);
      console.log("DocHandle wurde erstellt "+ this.handle.url);
      this.handle.on("change", (d) => {
        console.log("Änderung im Dokument erkannt, synchronisiere...");
        this.syncFromDoc(d.doc);
      });
      this.sessionInitialized = true; // Verhindert weitere Aufrufe
    }
  },
});
