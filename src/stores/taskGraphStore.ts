import { defineStore } from "pinia";
import type { StateTree } from "pinia";
import { useApplicationStore } from "./applicationStore";
import type { AvailableTasks } from "./applicationStore";
import type { SerialisedTask } from "./applicationStore";
import { JSONPath } from "jsonpath-plus";
import { Repo, DocHandle, AnyDocumentId } from "@automerge/automerge-repo/slim";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";

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

// Automerge-Repo initialisieren
const repo = new Repo({
  network: [
    new BrowserWebSocketClientAdapter("ws://localhost:3000"),
    new BroadcastChannelNetworkAdapter(),
  ],
  storage: new IndexedDBStorageAdapter(),
});
    console.log("Repo erstellt:", repo);

// Handle mit spezifischem Typ und initialem Wert null
let handle: DocHandle<{ taskGraph: Record<string, unknown> }> | null = null;

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
}

export type TaskGraphStateKey = keyof TaskGraphState;

//SessionId nur einmal vom Server abrufen
let sessionInitialized = false;

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

  // Synchronisiere Änderungen vom Store in Automerge
  syncToDoc() {
    if (!handle) {
      console.error("No handle available for syncing.");
      return;
    }

      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    handle.change((doc: any) => {
      if (!doc.taskGraph) {
        doc.taskGraph = {};
      }

      for (const [key, value] of Object.entries(this.$state)) {
        if (key in doc.taskGraph) {
          doc.taskGraph[key] = value;
        }
      }
    });
  },

  // Dokument mit Automerge laden
  async loadDocument() {
    if (!this.documentId) {
      console.error("Document ID is missing.");
      return;
    }

    handle = repo.find(this.documentId);

    handle.whenReady().then(() => {
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      handle?.change((doc: any) => {
        if (!doc.taskGraph) {
          doc.taskGraph = {};
        }
      });

      this.syncFromDoc(handle?.doc);
    });

      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    handle.on("change", (d: any) => {
      this.syncFromDoc(d.doc);
    });
  },
    setProperty(payload: StoreSetterPayload) {
      const { path, value } = payload;
      const splitPath = JSONPath.toPathArray(path).slice(1);
      let subState = this.$state as StateTree;
      for (let depth = 0; depth < splitPath.length; depth++) {
        if (depth === splitPath.length - 1) {
          // only update the value if it is different
          if (subState[splitPath[depth]] != value) {
            subState[splitPath[depth]] = value;
          }
        } else {
          subState = subState[splitPath[depth]];
        }
      }

      /**
       * Log the state change in development mode.
       */
      process.env.NODE_ENV === "development" && console.log(path, value);
      this.syncToDoc();
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
      if (sessionInitialized) {
        console.log("Session already initialized.");
        return;
      }

      try {
        console.log("Versuch joinSession");
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
        sessionInitialized = true; // Verhindert weitere Aufrufe
        console.log("Document ID:", this.documentId); // Debug-Ausgabe
      } catch (error) {
        console.error("Error joining session:", error);
      }
      await this.loadDocument();

    },
  },
});
