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
  if (documentReady.value) {    return;  }

  /* ---------------- Server-Token holen ---------------- */
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
  if (!documentId) {    return;  }


  /* ---------------- Automerge-Handle anlegen ---------------- */
  handle = repo.find(documentId);

  handle.on("change", d => {
    console.log("Change-Event von anderem Peer empfangen", d);
    syncFromDocComponents(d.doc, taskGraphStore);
  });
  await handle.whenReady()
    documentReady.value = true;
    console.log("DocHandle ist bereit", handle.documentId);
    const snapshot = await handle.doc();
    console.log ("Snapshot ist bereit", snapshot);
    /* ---------- Initial-Sync NUR EINMAL beim ersten Peer ---------- */
    handle.change(doc => {
      doc.componentsData ??= {};                                   // NEU  – Wurzel-Map nur einmal anlegen

      /* ---- alle fieldValueByUser-Slots aus der Einzelarbeit ---- */
      const fieldValues = taskGraphStore.extractFieldValues();
      console.log("fieldValues aus der Einzelarbeit ", fieldValues);

      for (const { path, value } of fieldValues) {
        if (!path.includes("fieldValueByUser")) continue;

        const match = path.match(/(.*\.fieldValueByUser)\.(\d+)$/);
        if (!match) { console.warn("Bad path", path); continue; }

        const base   = match[1];
        const userId = match[2];
        const flatKey = `${base}.${userId}`;

        const clean = extractCleanValue(value);
        doc.componentsData![flatKey] = clean;
        console.log("Flat-Key in Automerge geschrieben:", flatKey, clean);
      }
    });

    if (snapshot) {
      lastComponentsDataCache.value = JSON.parse(JSON.stringify(snapshot.componentsData ?? {}));

      console.log("Initiales syncFromDocComponents");
      syncFromDocComponents(snapshot, taskGraphStore);             // NEU
    };


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

  if (!(path.endsWith(".fieldValue") || path.includes("fieldValueByUser"))) {
    console.log("Ignoriere Sync, da kein relevantes Feld:", path);
    return;
  }
  // Extrahiere sauberen Wert ohne Vue-interne Eigenschaften
  const cleanVal = extractCleanValue(value);

  handle.change((doc) => {
    if (!doc.componentsData) {
      doc.componentsData = {}; // nur ein Mal anlegen
    }
    doc.componentsData[path] = cleanVal;             // NEU
    console.log("syncSingleComponentChange (flat) ->", path, cleanVal);
    console.log ("User ist ", uid)
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
