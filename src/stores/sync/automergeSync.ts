import { ref } from "vue";
import { AnyDocumentId, DocHandle, Repo } from "@automerge/automerge-repo/slim";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import wasmUrl from "@automerge/automerge/automerge.wasm?url";
import { next as Automerge } from "@automerge/automerge/slim";

(async () => {
  // WebAssembly-Modul initialisieren
  await Automerge.initializeWasm(wasmUrl);
})();

import { useTaskGraphStore } from "../taskGraphStore";
//import type { useApplicationStore } from "../applicationStore"
import { JSONPathExpression } from "carpet-component-library";

// Konstant für die Session-ID
const SESSION_ID = 43;

// Server-Endpunkt
const SERVER_URL = "http://localhost:3000"; // Passe die URL an deinen Server an

interface ComponentDoc {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  componentsData?: { [idOrPath: string]: any };
}
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
const lastComponentsDataCache = ref<Record<string, any> | null>(null);

let documentId: AnyDocumentId;
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
let handle: DocHandle<ComponentDoc>;
const documentReady = ref(false);
const isRemoteUpdate = ref(false);
let isJoinSessionProcessing = false;

const repo = new Repo({
  network: [
    new BrowserWebSocketClientAdapter("ws://localhost:3000"),
    new BroadcastChannelNetworkAdapter(),
  ],
  storage: new IndexedDBStorageAdapter(),
});

/**
 * joinSession - initializes the Automerge-Session
 */
export async function joinSession(taskGraphStore: ReturnType<typeof useTaskGraphStore>) {
  if (isJoinSessionProcessing) {
    console.log("joinSession läuft gerade, breche erneuten Aufruf ab");
    return;
  }
  isJoinSessionProcessing = true;
  if (documentReady.value) {
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
  handle.whenReady().then(() => {
    documentReady.value = true;
    console.log("DocHandle ist bereit "+handle.documentId);
    // Check, if Document has NO componentsData
    const doc = handle.docSync();
    if (!doc?.componentsData) {
      console.log("Dokument leer, führe initialen Voll-Sync aus...");
      handle.change((doc) => {
        doc.componentsData = {};

        // Get TaskGraphStore and read complete Subtree
        const componentData = taskGraphStore.extractComponentData();
        console.log("Sub-State beim initialen Voll-Sync: ", componentData);
        // => z. B. [{ id: number, data: any }, ...]

        // Write everything to Automerge-Dokument
        for (const { id, data } of componentData) {
          doc.componentsData![id.toString()] = JSON.parse(JSON.stringify(data));
        }
        console.log("Automerge-Dokument initial angelegt: ", doc.componentsData)
      });
    }
  });
  handle.on("change", (d) => {
    console.log("Change-Event von anderem Peer empfangen", d);
    syncFromDocComponents(d.doc, taskGraphStore);
  });
  isJoinSessionProcessing = false;
};

/**
 * syncSingleComponentChange - writes path+value from store to Automerge-Document
 */
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
export async function syncSingleComponentChange(path: string, value: any) {
  if (!documentReady.value) {
    console.warn("Dokument noch nicht bereit, kann nicht syncen");
    return;
  }
  if (isRemoteUpdate.value) {
    return;
  }
  handle.change((doc) => {
    if (!doc.componentsData) {
      doc.componentsData = {}; // nur ein Mal anlegen
    }
    doc.componentsData[path] = JSON.parse(JSON.stringify(value));
  });
  console.log("syncSingleComponentChange -> Path: ${path}, Value:", value);
  isRemoteUpdate.value = false;
};

/**
 * syncFromDocComponents - compares doc.componentsData with lastComponentsDataCache
 * and applies changes from Automerge to the Store
 */
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
export function syncFromDocComponents(  doc: { componentsData?: Record<string, any> },
  taskGraphStore: ReturnType<typeof useTaskGraphStore>
) {
  console.log("syncFromDocComponents aufgerufen", doc);
  if (!doc.componentsData) return;

  const newComponents = doc.componentsData;
  const oldComponents = lastComponentsDataCache; // globale oder store-weite Variable

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  const changedEntries: Array<{ pathOrId: string; data: any }> = [];

  // 1) Find changed or new Keys
  for (const [key, val] of Object.entries(newComponents)) {
    if (!oldComponents.value || JSON.stringify(oldComponents.value[key]) !== JSON.stringify(val)) {
      changedEntries.push({ pathOrId: key, data: val });
    }
  }
  // 2) Find deleted Keys
  if (oldComponents.value) {
    for (const key of Object.keys(oldComponents)) {
      if (!(key in newComponents)) {
        changedEntries.push({ pathOrId: key, data: undefined });
      }
    }
  }

  if (changedEntries.length === 0) {
    console.log("Keine echten Änderungen in componentsData");
    return;
  }
  console.log("Echte Änderungen:", changedEntries);
  // Update local cache
  lastComponentsDataCache.value = JSON.parse(JSON.stringify(newComponents));
  isRemoteUpdate.value = true;
  changedEntries.forEach(({ pathOrId, data }) => {
    // 1) data === undefined? => überspringen
    if (data === undefined) {
      console.log("Ignoriere Patch, da data===undefined:", pathOrId);
      return;
    }
    // Falls du "id" => {component data} hast:
    const idNum = Number(pathOrId);
    console.log("pathOrId", pathOrId);
    console.log("idNum ", idNum);
    if (!isNaN(idNum)) {
      taskGraphStore.applySynchronizedChanges([{ id: idNum, data }]);
    } else {
      console.log("Wende Pfad an:", pathOrId);
      taskGraphStore.setProperty({
        path: pathOrId as JSONPathExpression,
        value: data,
      });
    }
  });
  isRemoteUpdate.value = false;
}


