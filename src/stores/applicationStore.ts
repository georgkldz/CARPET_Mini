import { defineStore } from "pinia";
import { ref } from "vue";
import type { Ref } from "vue";
import axios, { AxiosError } from "axios";
import serialisedTaskSchema from "../schemas/zodSchemas/SerialisedTaskSchema";

import type {
  SerializedDOTGraphComponent,
  SerializedFormComponent,
  SerializedButtonComponent,
  SerializedInputFieldComponent,
} from "carpet-component-library";


import { AnyDocumentId, DocHandle, Repo } from "@automerge/automerge-repo/slim";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
// URL zur WebAssembly-Binary mit ?url laden
import wasmUrl from "@automerge/automerge/automerge.wasm?url";
// Slim-Varianten von Automerge und Automerge-Repo verwenden
import { next as Automerge } from "@automerge/automerge/slim";
// import type { SerializedCustomComponents } from "../components/index";
import type { SerializedBasicInputFieldComponent } from "../components/BasicInputField/BasicInputField";
import { SerializedLatexInputComponent } from "components/LatexInput/LatexInput.ts";
import ExampleTask from "../SerialisedTasks/Example.carpet.json";
import { SerializedLatexInputFieldComponent } from "components/LatexInputField/LatexInputField.ts";
const staticTasks = { Example: serialisedTaskSchema.parse(ExampleTask) };
import { TaskGraphState, useTaskGraphStore } from "./taskGraphStore";
import type { Doc } from "@automerge/automerge";

(async () => {
  // WebAssembly-Modul initialisieren
  await Automerge.initializeWasm(wasmUrl);
})();
interface TaskGraph {
  [key: string]: unknown;
}

// Konstant für die Session-ID
const SESSION_ID = 43;

// Server-Endpunkt
const SERVER_URL = "http://localhost:3000"; // Passe die URL an deinen Server an

let documentId: AnyDocumentId;
let handle: DocHandle<{ taskGraph: Record<string, unknown> }>;

/**
 * The available tasks in the current application.
 */
export type AvailableTasks = keyof typeof staticTasks;

export interface SerialisedComponents {
  [id: number]:
    | SerializedDOTGraphComponent
    | SerializedBasicInputFieldComponent
    | SerializedLatexInputComponent
    | SerializedLatexInputFieldComponent
    | SerializedBasicInputFieldComponent
    | SerializedFormComponent
    | SerializedButtonComponent
    | SerializedInputFieldComponent;
}

export type LayoutSizes = "phone" | "tablet" | "desktop";
export type Layout = {
  [id: number]: {
    x: number;
    y: number;
    height: number;
    width: number;
    padding?: number;
  };
};

export type Layouts = {
  [layoutSize in LayoutSizes]: Layout;
};

export interface TaskData {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface Hints {
  active: boolean;
  current: number;
  descriptions: Array<string>;
}

export interface Modal {
  trigger: {
    type: "success";
  };
  content: {
    header: string;
    body: string;
    footer: {
      buttons: Array<{
        type: "close" | "route";
        label: string;
        parameters?: {
          route: string;
        };
      }>;
    };
  };
}
export type Modals = Array<Modal>;

export interface SerialisedNode {
  layouts: Layouts;
  components: SerialisedComponents;
  hints?: Hints;
  modal?: Modals;
  isValid?: boolean;
  isCorrect?: boolean;
}
export interface SerialisedNodes {
  [id: number]: SerialisedNode;
}

export interface SerialisedTask {
  nodes: SerialisedNodes;
  edges: {
    [nodeId: number]: Array<number>;
  };
  feedbackLevel?:
    | "none"
    | "validity"
    | "correctness"
    | "unpromptedHints"
    | "unpromptedFeedback";
  layoutSize?: LayoutSizes;
  rootNode?: number;
  taskData?: TaskData;
}



//Composition API
export const useApplicationStore = defineStore("applicationStore", () => {

  let getTaskGraphState: (() => TaskGraphState) | null = null;
  const repo = new Repo({
    network: [
      new BrowserWebSocketClientAdapter("ws://localhost:3000"),
      new BroadcastChannelNetworkAdapter(),
    ],
    storage: new IndexedDBStorageAdapter(),
  });

  const userId = ref<string | null>(null);
  const isAuthenticated = ref(false);

  let sessionInitialized = false;

  /**
   * (Mocked) Getter for reading all serialised tasks from the file system.
   * @returns A dictionary of tasks, where the key is the task name and the value is the serialised task.
   */
  const tasks = ref(staticTasks);

  const SNAP_GRID: Ref<[x: number, y: number]> = ref([30, 30]);

  const leftDrawerOpen = ref(false);
  const toggleLeftDrawer = () => {
    leftDrawerOpen.value = !leftDrawerOpen.value;
  };

  const darkMode = ref(false);
  const toggleDarkMode = () => {
    darkMode.value = !darkMode.value;
  };
  const login = async (payload: { email: string; password: string }) => {
    try {
      const response = await axios.post("http://localhost:3000/login", payload);
      userId.value = response.data.userId; // `.value` bei `ref` erforderlich
      isAuthenticated.value = true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Verwende AxiosError-Typisierung anstelle von `any`
        const axiosError = error as AxiosError<{ message: string }>;
        const errorMessage =
          axiosError.response?.data?.message || "Login fehlgeschlagen.";
        throw new Error(errorMessage);
      }
      // Allgemeiner Fehler
      throw new Error("Ein unbekannter Fehler ist aufgetreten.");
    }
  };

  const logout = async () => {
    try {
      await axios.post("http://localhost:3000/logout");
      userId.value = null;
      isAuthenticated.value = false;
      console.log("Logout erfolgreich!");
    } catch (error) {
      console.error(
        "Fehler beim Logout:",
        error instanceof Error ? error.message : error,
      );
      throw new Error("Logout fehlgeschlagen.");
    }
  };

  // Synchronisiere Änderungen von Automerge ins Store
  // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/ban-ts-comment

    const syncFromDoc = (doc: Doc<{ taskGraph: TaskGraph }>): void => {
      if (!handle?.isReady) {
        console.warn(
          "No handle available for syncing. Stelle sicher, dass loadDocument erfolgreich abgeschlossen ist."
        );
        return;
      }
      console.log("syncFROMDoc aufgerufen");
      if (!doc.taskGraph) return;

      const taskGraphStore = useTaskGraphStore(); // Importiere den taskGraphStore
      for (const [key, value] of Object.entries(doc.taskGraph)) {
        taskGraphStore.setProperty({ path: `$.${key}`, value }); // Direkt auf den Store zugreifen
      }
    };


  const syncToDoc = () => {
    console.log("syncToDoc aufgerufen");
    if (!getTaskGraphState) {
      console.warn("No taskGraphState callback defined.");
      return;
    }

    const taskGraphState = getTaskGraphState();
    if (!taskGraphState) {
      console.warn("TaskGraphState is undefined.");
      return;
    }
    if (!handle?.isReady) {
      console.warn(
        "No handle available for syncing. Stelle sicher, dass loadDocument erfolgreich abgeschlossen ist."
      );
      return;
    }

    handle.change((doc) => {
      if (!doc.taskGraph) {
        doc.taskGraph = {};
      }
      console.log("handle.change aufgerufen")
      // Synchronisiere alle Schlüssel aus dem Store
      for (const [key, value] of Object.entries(taskGraphState)) {
        if (doc.taskGraph[key] !== value) {
          doc.taskGraph[key] = value;
        }
      }
    console.log(doc);
    });
  }

   const joinSession = async() => {
    if (sessionInitialized) {
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
      documentId = data.documentUrl;
    } catch (error) {
    }
    if (!documentId) {
      return;
    }
    handle = repo.find(documentId);
    handle.on("change", (d) => {
      syncFromDoc(d.doc);
    });
    sessionInitialized = true; // Verhindert weitere Aufrufe
  };
  const registerTaskGraphStateCallback = (callback: () => TaskGraphState) => {
    console.log("Callback für TaskGraphState registriert");
    getTaskGraphState = callback;
  };

  return {
    leftDrawerOpen,
    toggleLeftDrawer,
    darkMode,
    toggleDarkMode,
    tasks,
    SNAP_GRID,
    userId,
    isAuthenticated,
    login,
    logout,
    joinSession,
    syncFromDoc,
    syncToDoc,
    registerTaskGraphStateCallback,
  };
});
