import { ref } from "vue";
import { AnyDocumentId, DocHandle, Repo } from "@automerge/automerge-repo/slim";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import wasmUrl from "@automerge/automerge/automerge.wasm?url";
import { next as Automerge } from "@automerge/automerge/slim";
import { isEqual } from "lodash";

(async () => {
  await Automerge.initializeWasm(wasmUrl);
})();

import { useTaskGraphStore } from "stores/taskGraphStore.js";
import { JSONPathExpression } from "carpet-component-library";

// Server-Endpunkt
const API_BASE = "http://localhost:3000/api/v1"; // REST + SSE
const WS_URL = "ws://localhost:3000/sync"; // Automerge‑Socket

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
    new BrowserWebSocketClientAdapter(WS_URL),
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
  console.log("extractCleanValue bearbeitet ", value);
  if (value && typeof value === "object" && value.__v_isRef === true) {
    console.log("extractCleanValue gibt zurück ", value.value)
    return extractCleanValue(value.value);
  }

  // Für primitive Typen direkt zurückgeben
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  // Bei Arrays jeden Eintrag rekursiv verarbeiten
  if (Array.isArray(value)) {
    return value.map((item) => extractCleanValue(item));
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
  console.log("joining session mit sessionId", sessionId);
  if (isJoinSessionProcessing) {
    console.log("joinSession läuft gerade, breche erneuten Aufruf ab");
    return;
  }
  isJoinSessionProcessing = true;
  if (documentReady.value) {
    return;
  }
  try {
    const response = await fetch(`${API_BASE}/joinSession`, {
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
        const componentData = fieldValues.map((item) => {
          // Hier Transformation je nach Bedarf
          return {
            id: extractIdFromPath(item.path), // Hilfsfunktion, die ID aus Pfad extrahiert
            data: item.value,
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
export async function syncSingleComponentChange(
  path: string,
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  value: any,
  uid?: number,
) {
  if (!documentReady.value) {
    console.warn("Dokument noch nicht bereit, kann nicht syncen");
    return;
  }
  const isSingle = path.endsWith(".fieldValue");
  const isMap = path.includes("fieldValueByUser");

  if (!isSingle && !isMap) {
    console.log("Ignoriere Sync, da kein relevantes Feld:", path);
    return;
  }
  // Extrahiere sauberen Wert ohne Vue-interne Eigenschaften
  const cleanVal = extractCleanValue(value);

  handle.change((doc) => {
    if (!doc.componentsData) {
      doc.componentsData = {}; // nur ein Mal anlegen
    }
    if (isSingle) {
      doc.componentsData[path] = cleanVal; // Alt-Fall
      console.log("syncSingleComponentChange -> Path: ${path}, Value:", cleanVal);
    } else if (isMap) {
      // Pfad zum Map-Objekt ermitteln
      const basePath = path.replace(/\.[0-9]+$/, ""); // kappt ".<uid>"
      console.log("basePath ", basePath);
      doc.componentsData[basePath] ??= {}; // Map anlegen
      doc.componentsData[basePath][uid!] = cleanVal; // Slot setzen
      console.log("syncSingleComponentChange -> Path: ${basePath}, Value:",basePath, cleanVal);
    }
  });

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
  console.log("syncFromDocComponents aufgerufen", doc.componentsData);
  if (!doc.componentsData) return;

  const newComponentsRaw = doc.componentsData;

  // 1) Filtere Vue-spezifische Keys heraus und nur .fieldValue-Pfade beibehalten
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  const newComponents: Record<string, any> = {};
  for (const [key, val] of Object.entries(newComponentsRaw)) {
    // Überspringe Vue-interne Eigenschaften und nicht-fieldValue Pfade
    if (
      key === "dep" ||
      key.startsWith("__v_") ||
      (key.startsWith("_") && ["_rawValue", "_value"].includes(key))
    ) {
      console.log("rausgefiltert wird ", key, val);
      continue;
    }
    // Bereinigen der Werte
    newComponents[key] = extractCleanValue(val);
    console.log("zu newComponents hinzugefügt",newComponents[key]);
  }


  const oldComponents = lastComponentsDataCache;
  console.log("oldComponents sind", oldComponents);

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  const changedEntries: Array<{ path: string; data: any }> = [];
  console.log("Iteriere über keys, vals und finde Änderungen")
  // 2) Find changed or new Keys
  for (const [key, val] of Object.entries(newComponents)) {

    if (!oldComponents.value || !isEqual(oldComponents.value[key], val)) {
      changedEntries.push({ path: key, data: val });
      console.log("Eintrag hinzugefügt in find changed or new ", key, val);
    }
  }
  // 3) Find deleted Keys
  if (oldComponents.value) {
    for (const key of Object.keys(oldComponents.value)) {
      if (!key.endsWith(".fieldValue") && !key.includes("fieldValueByUser")) {
        console.log("Übersprungen wird ", key, oldComponents.value[key]);
        continue;
      }
      if (!(key in newComponents)) {
        changedEntries.push({ path: key, data: undefined });
        console.log("Eintrag undefined gesetzt in find deleted ", key);
      }
    }
  }

  if (changedEntries.length === 0) {
    console.log("Keine echten Änderungen in componentsData");
    return;
  }
  console.log("Echte Änderungen:", changedEntries.values());

  // Update local cache
  lastComponentsDataCache.value = JSON.parse(JSON.stringify(newComponents));

  changedEntries.forEach(({ path, data }) => {
    if (data === undefined) {
      console.log("Ignoriere Patch (delete):", path);
      return;
    }

    // Sicherheits­check für beide Typen
    if (!path.endsWith(".fieldValue") && !path.includes("fieldValueByUser")) {
      console.log("Ignoriere Patch, keiner der erlaubten Pfade:", path);
      return;
    }

    console.log("Übernehme Patch:", path, data);
    taskGraphStore.setProperty({
      path: path as JSONPathExpression,
      value: data,
    });
  });
}
