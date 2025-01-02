import { defineStore } from "pinia";
import { ref } from "vue";
import type { Ref } from "vue";
import axios, { AxiosError } from "axios";
import serialisedTaskSchema from "../schemas/zodSchemas/SerialisedTaskSchema";

import type {
  SerializedDOTGraphComponent,
  SerializedFormComponent,
  SerializedButtonComponent,
  SerializedInputFieldComponent //, JSONPathExpression
} from "carpet-component-library";


// import { AnyDocumentId, DocHandle, Repo } from "@automerge/automerge-repo/slim";
// import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
// import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
// import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
// URL zur WebAssembly-Binary mit ?url laden
import wasmUrl from "@automerge/automerge/automerge.wasm?url";
// Slim-Varianten von Automerge und Automerge-Repo verwenden
import { next as Automerge } from "@automerge/automerge/slim";
// import type { SerializedCustomComponents } from "../components/index";
import type { SerializedBasicInputFieldComponent } from "../components/BasicInputField/BasicInputField";
import { SerializedLatexInputComponent } from "components/LatexInput/LatexInput.ts";
import ExampleTask from "../SerialisedTasks/Example.carpet.json";
import { SerializedLatexInputFieldComponent } from "components/LatexInputField/LatexInputField.ts";
import {SerializedTextViewComponent} from "components/TextView/TextView.ts";

const staticTasks = { Example: serialisedTaskSchema.parse(ExampleTask) };
import {  useTaskGraphStore } from "./taskGraphStore";
import {joinSession, syncSingleComponentChange} from "stores/sync/automergeSync.ts";

(async () => {
  // WebAssembly-Modul initialisieren
  await Automerge.initializeWasm(wasmUrl);
})();

// Konstant für die Session-ID
//const SESSION_ID = 43;

// Server-Endpunkt
//const SERVER_URL = "http://localhost:3000"; // Passe die URL an deinen Server an

// interface ComponentDoc {
//   // eslint-disable-next-line  @typescript-eslint/no-explicit-any
//   componentsData?: { [idOrPath: string]: any };
// }
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
//const lastComponentsDataCache = ref<Record<string, any> | null>(null);

//let documentId: AnyDocumentId;
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
//let handle: DocHandle<ComponentDoc>;

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
    | SerializedInputFieldComponent
    | SerializedTextViewComponent;
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

  // const repo = new Repo({
  //   network: [
  //     new BrowserWebSocketClientAdapter("ws://localhost:3000"),
  //     new BroadcastChannelNetworkAdapter(),
  //   ],
  //   storage: new IndexedDBStorageAdapter(),
  // });

  const userId = ref<string | null>(null);
  const isAuthenticated = ref(false);
  const documentReady = ref(false);
  const isRemoteUpdate = ref(false);
  //let isJoinSessionProcessing = false;


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
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  // function syncSingleComponentChange(path: string, value: any) {
  //   if (!documentReady.value) {
  //     console.warn("Dokument noch nicht bereit, kann nicht syncen");
  //     return;
  //   }
  //   if (isRemoteUpdate.value) {
  //     return;
  //   }
  //   // Übernimm die fieldValues ins TaskGraphStore
  //   handle.change((doc) => {
  //     if (!doc.componentsData) {
  //       doc.componentsData = {}; // nur ein Mal anlegen
  //     }
  //     doc.componentsData[path] = JSON.parse(JSON.stringify(value));
  //   });
  //   console.log("syncSingleComponentChange -> Path: ${path}, Value:", value);
  //   isRemoteUpdate.value = false;
  // };

  function joinSessionWrapper() {
    const taskGraphStore = useTaskGraphStore();
    joinSession(taskGraphStore);
  }

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  function syncSingleComponentWrapper(path: string, value: any) {
    syncSingleComponentChange(path, value);
  }

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  // function syncFromDocComponents(doc: { componentsData?: Record<string, any> }) {
  //   console.log("syncFromDocComponents aufgerufen", doc);
  //   if (!doc.componentsData) return;
  //
  //   // Neuen Stand
  //   const newComponents = doc.componentsData;
  //   // Optional: Alten Stand cachen
  //   const oldComponents = lastComponentsDataCache; // globale oder store-weite Variable
  //
  //   // Vergleiche
  //   // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  //   const changedEntries: Array<{ pathOrId: string; data: any }> = [];
  //
  //   // 1) Finde geänderte oder neue Keys
  //   for (const [key, val] of Object.entries(newComponents)) {
  //     if (!oldComponents.value || JSON.stringify(oldComponents.value[key]) !== JSON.stringify(val)) {
  //       changedEntries.push({ pathOrId: key, data: val });
  //     }
  //   }
  //   // 2) Finde gelöschte Keys (optional)
  //   if (oldComponents.value) {
  //     for (const key of Object.keys(oldComponents)) {
  //       if (!(key in newComponents)) {
  //         changedEntries.push({ pathOrId: key, data: undefined });
  //       }
  //     }
  //   }
  //
  //   if (changedEntries.length === 0) {
  //     console.log("Keine echten Änderungen in componentsData");
  //     return;
  //   }
  //
  //   console.log("Echte Änderungen:", changedEntries);
  //
  //   // Update local cache
  //   lastComponentsDataCache.value = JSON.parse(JSON.stringify(newComponents));
  //
  //   const taskGraphStore = useTaskGraphStore();
  //   // Wir setzen isRemoteUpdate, falls du sicherstellen willst,
  //   // dass applySynchronizedChanges kein erneutes Sync auslöst.
  //   isRemoteUpdate.value = true;
  //   changedEntries.forEach(({ pathOrId, data }) => {
  //     // 1) data === undefined? => überspringen
  //     if (data === undefined) {
  //       console.log("Ignoriere Patch, da data===undefined:", pathOrId);
  //       return;
  //     }
  //     // Falls du "id" => {component data} hast:
  //     const idNum = Number(pathOrId);
  //     console.log("pathOrId", pathOrId);
  //     console.log("idNum ", idNum);
  //     if (!isNaN(idNum)) {
  //       taskGraphStore.applySynchronizedChanges([{ id: idNum, data }]);
  //     } else {
  //       console.log("Wende Pfad an:", pathOrId);
  //       taskGraphStore.setProperty({
  //         path: pathOrId as JSONPathExpression,
  //         value: data,
  //       });
  //     }
  //   });
  //   isRemoteUpdate.value = false;
  // }


  // const joinSession = async() => {
  //   if (isJoinSessionProcessing) {
  //     console.log("joinSession läuft gerade, breche erneuten Aufruf ab");
  //     return;
  //   }
  //   isJoinSessionProcessing = true;
  //   if (documentReady.value) {
  //     return;
  //   }
  //
  //   try {
  //     const response = await fetch(`${SERVER_URL}/joinSession`, {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify({ sessionId: SESSION_ID }),
  //     });
  //
  //     if (!response.ok) {
  //       throw new Error("Failed to join session");
  //     }
  //     const data = await response.json();
  //     documentId = data.documentUrl;
  //   } catch (error) {
  //   }
  //   if (!documentId) {
  //     return;
  //   }
  //   handle = repo.find(documentId);
  //   handle.whenReady().then(() => {
  //     documentReady.value = true;
  //     console.log("DocHandle ist bereit "+handle.documentId);
  //     // Prüfen, ob das Dokument noch KEINE componentsData enthält
  //     const doc = handle.docSync();
  //     if (!doc?.componentsData) {
  //       console.log("Dokument leer, führe initialen Voll-Sync aus...");
  //       handle.change((doc) => {
  //         doc.componentsData = {};
  //
  //         // Hole den TaskGraphStore und lese den gesamten relevanten Unterbaum
  //         const taskGraphStore = useTaskGraphStore();
  //         const componentData = taskGraphStore.extractComponentData();
  //         console.log("Sub-State beim initialen Voll-Sync: ", componentData);
  //         // => z. B. [{ id: number, data: any }, ...]
  //
  //         // Übertrage alles ins Automerge-Dokument
  //         for (const { id, data } of componentData) {
  //           doc.componentsData![id.toString()] = JSON.parse(JSON.stringify(data));
  //         }
  //         console.log("Automerge-Dokument initial angelegt: ", doc.componentsData)
  //       });
  //     }
  //   });
  //   handle.on("change", (d) => {
  //     console.log("Change-Event von anderem Peer empfangen", d);
  //     syncFromDocComponents(d.doc);
  //   });
  //   isJoinSessionProcessing = false;
  // };



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
    joinSession: joinSessionWrapper,
    syncSingleComponentChange: syncSingleComponentWrapper,
    documentReady,
    isRemoteUpdate,
  };
});

