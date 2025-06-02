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

// Typdefinition für Change-Handler ohne ChangeEvent
type ChangeHandler = (event: { doc: ComponentDoc }) => void;

// Variable für Change-Handler Referenz
let changeHandlerRef: ChangeHandler | null = null;

/**
 * Soft-Reset der Session - ruft Server-Endpunkt auf
 */
export async function softResetSession(sessionId: number): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/softResetSession`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      throw new Error(`Soft-Reset fehlgeschlagen: ${response.statusText}`);
    }

    const data = await response.json();
    console.debug("Soft-Reset erfolgreich:", data);

    // Lokalen Cache leeren
    lastComponentsDataCache.value = {};

    return true;
  } catch (error) {
    console.error("Fehler beim Soft-Reset:", error);
    return false;
  }
}

/**
 * Verbesserte Funktion zum Entfernen aller Vue-internen Eigenschaften
 * Extrahiert auch .value aus Ref-Objekten
 */
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
function extractCleanValue(value: any): any {
  // Wenn es ein Ref-Objekt ist, extrahiere .value
  console.debug("automerge, extractCleanValue bearbeitet ", value);
  if (value && typeof value === "object" && value.__v_isRef === true) {
    console.debug("automerge, extractCleanValue gibt zurück ", value.value)
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
): Promise<void>  {
  console.debug("automerge, joining session mit sessionId", sessionId);
  if (isJoinSessionProcessing) {
    console.debug("automerge, joinSession läuft gerade, breche erneuten Aufruf ab");
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
    const data = await response.json();
    documentId = data.documentUrl;
  } catch (error) {}
  if (!documentId) {    return;  }


  /* ---------------- Automerge-Handle anlegen ---------------- */
  handle = repo.find(documentId);
  await handle.whenReady()
    documentReady.value = true;
    console.debug("automerge, DocHandle ist bereit", handle.documentId);

  const snapshot = await handle.doc();
  console.debug("automerge, doc geladen", snapshot?.componentsData);



  taskGraphStore.setProperty({
    path : "$.documentReady",
    value: true
  });

  console.debug("automerge, automergeSync ruft extractFieldValues auf")
  taskGraphStore.transferStateValuesToCollab();

  const handleChange: ChangeHandler = (event) => {
    console.debug("automerge, Change-Event empfangen", event);
    syncFromDocComponents(event.doc, taskGraphStore);
  };

  // Handler speichern für späteren Cleanup
  changeHandlerRef = handleChange;
  handle.on("change", handleChange);
  /* -------- Initiale lokale Übernahme der bereits existierenden Daten -------- */

  if (snapshot) {
  console.debug("automerge, Initiales syncFromDocComponents aus snapshot");
  syncFromDocComponents(snapshot, taskGraphStore);
  }
  isJoinSessionProcessing = false;
}

export async function leaveSession(): Promise<void> {
  console.debug("automerge, leave session - Cleanup");

  try {
    // 1. Change-Listener entfernen
    if (changeHandlerRef && handle) {
      handle.off("change", changeHandlerRef);
      changeHandlerRef = null;
      console.debug("Change-Listener entfernt");
    }

    // 2. Handle zurücksetzen (ohne Dokument zu löschen)
    if (handle) {
      // Wir löschen das Dokument NICHT, da wir Soft-Reset verwenden
      handle = null as unknown as DocHandle<ComponentDoc>;
    }

    // 3. Variablen zurücksetzen
    documentId = null as unknown as AnyDocumentId;
    documentReady.value = false;
    isJoinSessionProcessing = false;
    lastComponentsDataCache.value = null;

    // 4. TaskGraphStore benachrichtigen
    const taskGraphStore = useTaskGraphStore();
    taskGraphStore.setProperty({
      path: "$.documentReady",
      value: false
    });

    console.debug("Session-Cleanup abgeschlossen");

  } catch (error) {
    console.error("Fehler beim Session-Cleanup:", error);
    // Trotzdem Variablen zurücksetzen
    documentReady.value = false;
    isJoinSessionProcessing = false;
  }
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
  console.debug("automerge, syncSingleComponentChange betreten", path, uid);
  if (!documentReady.value) {
    console.warn("Dokument noch nicht bereit, kann nicht syncen");
    return;
  }

  if (!(path.endsWith(".fieldValue") || path.includes("fieldValueByUser") )) {
    console.log("Ignoriere Sync, da kein relevantes Feld:", path);
    return;
  }
  // Extrahiere sauberen Wert ohne Vue-interne Eigenschaften
  const cleanVal = extractCleanValue(value);

  handle.change((doc) => {
    console.debug("automergeSync, handle.change innerhalb syncSingleComponentChange betreten", path, doc);
    if (!doc.componentsData) {
      console.debug("automerge, innerhalb syncSingleComponentChange wird automerge-Dokument initial angelegt weil keine Struktur vorhanden");
      doc.componentsData = {}; // nur ein Mal anlegen
    }
    doc.componentsData[path] = cleanVal;             // NEU
    console.debug("automerge, syncSingleComponentChange (flat) ->", path, cleanVal, uid);

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
  console.log("automerge, syncFromDocComponents betreten, erhaltenes Dokument: ", doc.componentsData);
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
      console.debug("rausgefiltert wird ", key, val);
      continue;
    }
    // Bereinigen der Werte
    newComponents[key] = extractCleanValue(val);
    console.debug("zu newComponents hinzugefügt",newComponents[key]);
  }


  const oldComponents = lastComponentsDataCache;
  console.debug("oldComponents sind", oldComponents);

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  const changedEntries: Array<{ path: string; data: any }> = [];
  console.debug("Iteriere über keys, vals und finde Änderungen")
  // 2) Find changed or new Keys
  for (const [key, val] of Object.entries(newComponents)) {

    if (!oldComponents.value || !isEqual(oldComponents.value[key], val)) {
      changedEntries.push({ path: key, data: val });
      console.debug("Eintrag hinzugefügt in find changed or new ", key, val);
    }
  }
  // 3) Find deleted Keys
  if (oldComponents.value) {
    for (const key of Object.keys(oldComponents.value)) {
      if (!key.endsWith(".fieldValue") && !key.includes("fieldValueByUser")) {
        console.debug("Übersprungen wird ", key, oldComponents.value[key]);
        continue;
      }
      if (!(key in newComponents)) {
        changedEntries.push({ path: key, data: undefined });
        console.log("Eintrag undefined gesetzt in find deleted ", key);
      }
    }
  }

  if (changedEntries.length === 0) {
    console.debug("Keine echten Änderungen in componentsData");
    return;
  }
  console.debug("Echte Änderungen:", changedEntries.values());

  // Update local cache
  lastComponentsDataCache.value = JSON.parse(JSON.stringify(newComponents));

  changedEntries.forEach(({ path, data }) => {
    if (data === undefined) {
      console.log("Ignoriere Patch (delete):", path);
      return;
    }

    // Sicherheits­check für beide Typen
    if (!path.endsWith(".fieldValue") && !path.includes("fieldValueByUser")) {
      console.debug("Ignoriere Patch, keiner der erlaubten Pfade:", path);
      return;
    }

    console.debug("syncfromdoccomponents übergibt an setremoteproperty:", path, data);
    taskGraphStore.setRemoteProperty({
      path: path as JSONPathExpression,
      value: data,
    });
  });
}
