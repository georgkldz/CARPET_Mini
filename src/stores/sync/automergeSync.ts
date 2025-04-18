import { ref } from "vue";
import { AnyDocumentId, DocHandle, Repo } from "@automerge/automerge-repo/slim";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import wasmUrl from "@automerge/automerge/automerge.wasm?url";
import { next as Automerge } from "@automerge/automerge/slim";

(async () => {
  await Automerge.initializeWasm(wasmUrl);
})();

import { useTaskGraphStore } from "stores/taskGraphStore.js";
import { JSONPathExpression } from "carpet-component-library";

// Server-Endpunkt
const SERVER_URL = "http://localhost:3000"; // Passe die URL an deinen Server an

interface ComponentDoc {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  componentsData?: { [idOrPath: string]: any };
}
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
const lastComponentsDataCache = ref<Record<string, any> | null>(null);

let documentId: AnyDocumentId;
let handle: DocHandle<ComponentDoc>;
const documentReady = ref(false);
let isJoinSessionProcessing = false;

const repo = new Repo({
  network: [
    new BrowserWebSocketClientAdapter("ws://localhost:3000"),
    new BroadcastChannelNetworkAdapter(),
  ],
  storage: new IndexedDBStorageAdapter(),
});

/**
 * Verbesserte Funktion zum Entfernen aller Vue-internen Eigenschaften
 * Extrahiert auch .value aus Ref-Objekten
 */
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
function extractCleanValue(value: any): any {
  // Wenn es ein Ref-Objekt ist, extrahiere .value
  if (value && typeof value === "object" && value.__v_isRef === true) {
    return extractCleanValue(value.value);
  }

  // Für primitive Typen direkt zurückgeben
  if (value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean") {
    return value;
  }

  // Bei Arrays jeden Eintrag rekursiv verarbeiten
  if (Array.isArray(value)) {
    return value.map(item => extractCleanValue(item));
  }

  // Bei Objekten Vue-spezifische Eigenschaften entfernen
  if (typeof value === "object") {
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      // Vue-interne Eigenschaften überspringen
      if (
        key === "dep" ||
        key.startsWith("__v_") ||
        (key.startsWith("_") && ["_rawValue", "_value"].includes(key))
      ) {
        continue;
      }
      result[key] = extractCleanValue(val);
    }
    return result;
  }

  // Fallback
  return value;
}

/**
 * joinSession - initializes the Automerge-Session
 */
export async function joinSession(
  sessionId: number,
  taskGraphStore: ReturnType<typeof useTaskGraphStore>,
) {
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
      body: JSON.stringify({ sessionId }),
    });
    if (!response.ok) {
      throw new Error("Failed to join session");
    }
    const data = await response.json();
    documentId = data.documentUrl;
  } catch (error) {}
  if (!documentId) {
    return;
  }
  handle = repo.find(documentId);
  handle.whenReady().then(() => {
    documentReady.value = true;
    console.log("DocHandle ist bereit " + handle.documentId);
    // Check, if Document has NO componentsData
    const doc = handle.docSync();
    if (!doc?.componentsData) {
      console.log("Dokument leer, führe initialen Voll-Sync aus...");
      handle.change((doc) => {
        doc.componentsData = {};

        // Get TaskGraphStore and read complete Subtree
        const fieldValues = taskGraphStore.extractFieldValues();
        // Wenn nötig, Transformation zum erwarteten Format:
        const componentData = fieldValues.map(item => {
          // Hier Transformation je nach Bedarf
          return {
            id: extractIdFromPath(item.path), // Hilfsfunktion, die ID aus Pfad extrahiert
            data: item.value
          };
        });

        function extractIdFromPath(path: string): string {
          // Extrahiere die ID aus einem Pfad wie "$.nodes.0.components.123.state.fieldValue"
          const match = path.match(/\.components\.([^.]+)/);
          return match ? match[1] : "";
        }

        console.log("Sub-State beim initialen Voll-Sync: ", componentData);

        // Write everything to Automerge-Dokument, nur relevante fieldValue-Pfade
        for (const { id, data } of componentData) {
          // Bereinigen und nur relevante Werte synchronisieren
          const cleanData = extractCleanValue(data);

          // Prüfe ob ID gültig und sinnvoll ist
          if (id && id.trim() !== "") {
            // Speichere bereinigten Wert
            doc.componentsData![id.toString()] = cleanData;
          }
        }
        console.log(
          "Automerge-Dokument initial angelegt: ",
          doc.componentsData,
        );
      });
    }
  });
  handle.on("change", (d) => {
    console.log("Change-Event von anderem Peer empfangen", d);
    syncFromDocComponents(d.doc, taskGraphStore);
  });
  isJoinSessionProcessing = false;
}

/**
 * syncSingleComponentChange - writes path+value from store to Automerge-Document
 */
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
export async function syncSingleComponentChange(path: string, value: any) {
  if (!documentReady.value) {
    console.warn("Dokument noch nicht bereit, kann nicht syncen");
    return;
  }

  // WICHTIG: Nur Pfade, die auf .fieldValue enden, werden synchronisiert
  if (!path.endsWith(".fieldValue")) {
    console.log("Ignoriere Sync, da kein fieldValue-Pfad:", path);
    return;
  }

  // Extrahiere sauberen Wert ohne Vue-interne Eigenschaften
  const cleanVal = extractCleanValue(value);

  handle.change((doc) => {
    if (!doc.componentsData) {
      doc.componentsData = {}; // nur ein Mal anlegen
    }
    doc.componentsData[path] = cleanVal;
  });
  console.log(`syncSingleComponentChange -> Path: ${path}, Value:`, cleanVal);
}

/**
 * syncFromDocComponents - compares doc.componentsData with lastComponentsDataCache
 * and applies changes from Automerge to the Store
 */
export function syncFromDocComponents(
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  doc: { componentsData?: Record<string, any> },
  taskGraphStore: ReturnType<typeof useTaskGraphStore>,
) {
  console.log("syncFromDocComponents aufgerufen", doc);
  if (!doc.componentsData) return;

  const newComponentsRaw = doc.componentsData;

  // 1) Filtere Vue-spezifische Keys heraus und nur .fieldValue-Pfade beibehalten
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  const newComponents: Record<string, any> = {};
  for (const [key, val] of Object.entries(newComponentsRaw)) {
    // Überspringe Vue-interne Eigenschaften und nicht-fieldValue Pfade
    if (key === "dep" ||
      key.startsWith("__v_") ||
      (key.startsWith("_") && ["_rawValue", "_value"].includes(key)) ||
      !key.endsWith(".fieldValue")) {
      continue;
    }
    // Bereinigen der Werte
    newComponents[key] = extractCleanValue(val);
  }

  const oldComponents = lastComponentsDataCache;

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  const changedEntries: Array<{ pathOrId: string; data: any }> = [];

  // 2) Find changed or new Keys
  for (const [key, val] of Object.entries(newComponents)) {
    if (
      !oldComponents.value ||
      oldComponents.value[key] === undefined ||
      JSON.stringify(oldComponents.value[key]) !== JSON.stringify(val)
    ) {
      changedEntries.push({ pathOrId: key, data: val });
    }
  }
  // 3) Find deleted Keys
  if (oldComponents.value) {
    for (const key of Object.keys(oldComponents.value)) {
      // Nur fieldValue-Pfade berücksichtigen
      if (!key.endsWith(".fieldValue")) {
        continue;
      }
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

  changedEntries.forEach(({ pathOrId, data }) => {
    // Überspringe gelöschte Einträge
    if (data === undefined) {
      console.log("Ignoriere Patch, da data===undefined:", pathOrId);
      return;
    }

    // DOPPELTE ABSICHERUNG: Nochmals prüfen, ob es ein fieldValue-Pfad ist
    if (!pathOrId.endsWith(".fieldValue")) {
      console.log("Ignoriere Patch, da kein fieldValue:", pathOrId);
      return;
    }

    console.log("Übernehme fieldValue-Patch:", pathOrId, data);
    // Direkt setProperty verwenden, applySynchronizedChanges ist nicht mehr nötig
    taskGraphStore.setProperty({
      path: pathOrId as JSONPathExpression,
      value: data,
    });
  });
}
