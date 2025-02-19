import { Repo } from "@automerge/automerge-repo/slim";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
// URL zur WebAssembly-Binary mit ?url laden
import wasmUrl from "@automerge/automerge/automerge.wasm?url";
// Slim-Varianten von Automerge und Automerge-Repo verwenden
import { next as Automerge } from "@automerge/automerge/slim";

let repo: Repo | null = null; // Singleton-Instanz von Repo

// Initialisierungsfunktion
export const initializeRepo = async (): Promise<Repo> => {
  if (repo) {
    console.log("Repo wurde bereits initialisiert.");
    return repo;
  }

  console.log("Initialisiere Automerge...");
  await Automerge.initializeWasm(wasmUrl); // WebAssembly initialisieren

  console.log("Erstelle Repo...");
  repo = new Repo({
    network: [
      new BrowserWebSocketClientAdapter("ws://localhost:3000"),
      new BroadcastChannelNetworkAdapter(),
    ],
    storage: new IndexedDBStorageAdapter(),
  });

  console.log("Repo erfolgreich initialisiert:", repo);
  return repo;
};
