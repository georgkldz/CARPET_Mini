// src/services/uiSocketService.ts
import { ref } from "vue";
import { useTaskGraphStore } from "stores/taskGraphStore";

// Typdefinitionen
interface UISocketMessage {
  type: string;
  groupId?: number;
  userId?: number;
  senderRoleId?: number;
  targetNode?: number;
  currentNode?: number | null;
}

// Status der Verbindung
const connected = ref(false);
const connecting = ref(false);

// WebSocket-Referenz
let socket: WebSocket | null = null;

// Server-URL dynamisch aufbauen
const getServerUrl = (): string => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  // Host ohne Port, dann explizit Port 3000 anhängen
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:3000/ui-events`;
};
// Verbindung herstellen
export const connectUISocket = (groupId: number, userId: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (socket?.readyState === WebSocket.OPEN) {
      console.log("UI-Socket: Bereits verbunden");
      connected.value = true;
      resolve();
      return;
    }

    if (connecting.value) {
      console.log("UI-Socket: Verbindung wird bereits hergestellt");
      // Warten bis die Verbindung hergestellt ist
      const checkInterval = setInterval(() => {
        if (connected.value) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      return;
    }

    connecting.value = true;
    connected.value = false;

    try {
      const wsUrl = getServerUrl();
      console.debug("UI-Socket: Verbindung zu ${wsUrl} wird hergestellt");

      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("UI-Socket: Verbindung hergestellt");
        connected.value = true;
        connecting.value = false;

        // Gruppe beitreten
        sendMessage({
          type: "join",
          groupId,
          userId
        });

        resolve();
      };

      socket.onclose = (event) => {
        console.log(`UI-Socket: Verbindung geschlossen (Code: ${event.code})`);
        connected.value = false;
        connecting.value = false;
        socket = null;
      };

      socket.onerror = (error) => {
        console.error("UI-Socket: Verbindungsfehler", error);
        console.debug("UI-Socket: Verbindung fehlgeschlagen, URL war:", wsUrl);

        // Verbindungsstatus zurücksetzen
        connected.value = false;
        connecting.value = false;

        if (socket) {
          try {
            socket.close();
          } catch (e) {
            console.debug("UI-Socket: Fehler beim Schließen des fehlerhaften Sockets", e);
          }
          socket = null;
        }

        resolve();

        console.warn("UI-Socket: Die WebSocket-Verbindung konnte nicht hergestellt werden. Der Nodewechsel wird nur lokal funktionieren.");
      };

      socket.onmessage = handleMessage;

    } catch (error) {
      console.error("UI-Socket: Fehler beim Verbindungsaufbau", error);
      connected.value = false;
      connecting.value = false;
      socket = null;
      reject(error);
    }
  });
};

// Nachricht senden
export const sendMessage = (message: UISocketMessage): boolean => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error("UI-Socket: Keine Verbindung für das Senden der Nachricht");
    return false;
  }

  try {
    socket.send(JSON.stringify(message));
    return true;
  } catch (error) {
    console.error("UI-Socket: Fehler beim Senden der Nachricht", error);
    return false;
  }
};

// Zeigt die Musterlösung für alle anderen Gruppenmitglieder an
export const notifyShowSolution = (
  groupId: number,
  userId: number,
  senderRoleId: number,
  currentNode: number | null
): boolean => {
  return sendMessage({
    type: "showSolution",
    groupId,
    userId,
    senderRoleId,
    currentNode
  });
};

// Verbindung schließen
export const disconnectUISocket = (): void => {
  if (socket) {
    socket.close();
    socket = null;
  }
  connected.value = false;
  connecting.value = false;
};

// Eingehende Nachrichten verarbeiten
const handleMessage = (event: MessageEvent): void => {
  try {
    const message = JSON.parse(event.data) as UISocketMessage;
    console.log("UI-Socket: Nachricht empfangen", message);

    const taskGraphStore = useTaskGraphStore();

    switch (message.type) {
      case "showSolution":
        console.log("UI-Socket: Musterlösung anzeigen", message);
        // Aktuellen Node als vorherigen Node speichern
        taskGraphStore.setProperty({
          path: "$.previousNode",
          value: message.currentNode
        });

        // Zur Musterlösung wechseln
        taskGraphStore.setProperty({
          path: "$.currentNode",
          value: message.targetNode
        });
        break;

      default:
        console.warn(`UI-Socket: Unbekannter Nachrichtentyp: ${message.type}`);
    }

  } catch (error) {
    console.error("UI-Socket: Fehler beim Verarbeiten der Nachricht", error);
  }
};

// Verbindungsstatus exportieren
export const useUISocketStatus = () => ({
  connected,
  connecting
});
