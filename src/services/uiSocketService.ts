// src/services/uiSocketService.ts
import { ref } from "vue";
import { useTaskGraphStore } from "stores/taskGraphStore";
import { Dialog } from "quasar";
import SubmitPermissionDialog from "components/SubmitPermissionDialog.vue";

// Typdefinitionen
interface UISocketMessage {
  type: string;
  groupId?: number;
  userId?: number;
  senderRoleId?: number;
  targetNode?: number;
  currentNode?: number | null;
  votingRound?: number;
  vote?: "accepted" | "rejected";
  allApproved?: boolean;
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
  console.debug("[UI-Socket] sendMessage aufgerufen mit:", message);

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error("UI-Socket: Keine Verbindung für das Senden der Nachricht");
    console.error("UI-Socket: Socket-Status:", socket ? socket.readyState : "null");
    return false;
  }

  try {
    const messageStr = JSON.stringify(message);
    console.debug("[UI-Socket] Sende JSON:", messageStr);
    socket.send(messageStr);
    return true;
  } catch (error) {
    console.error("UI-Socket: Fehler beim Senden der Nachricht", error);
    return false;
  }
};


export const notifySubmitProposal = (
  groupId: number,
  userId: number,
  senderRoleId: number,
  votingRound: number
): boolean => {
  return sendMessage({
    type: "submitProposal",
    groupId,
    userId,
    senderRoleId,
    votingRound
  });
};

// NEU: Abstimmung senden
export const sendVote = (
  groupId: number,
  userId: number,
  vote: "accepted" | "rejected",
  votingRound: number
): boolean => {
  const message = {
    type: "vote",
    groupId,
    userId,
    vote,
    votingRound
  };
  console.debug("[UI-Socket] sendVote aufgerufen:", { groupId, userId, vote, votingRound });
  console.debug("[UI-Socket] Sende Nachricht:", message);

  return sendMessage(message);
};

// NEU: Zeigt die Musterlösung für alle anderen Gruppenmitglieder an
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
    console.debug("UI-Socket: Nachricht empfangen", message);

    const taskGraphStore = useTaskGraphStore();

    switch (message.type) {
      case "voteRequest":
        console.debug("UI-Socket: Abstimmungsanfrage erhalten", message);
        // Dialog für Abstimmung anzeigen
        showVotingDialog(message.groupId!, message.votingRound!);
        break;

      case "voteResult":
        console.log("UI-Socket: Abstimmungsergebnis erhalten", message);

        import("stores/collaborationStore").then(({ useCollaborationStore }) => {
          const collabStore = useCollaborationStore();
          if (message.allApproved) {
            console.debug("UI-Socket: Abstimmung angenommen, zeige Musterlösung");
            collabStore.finishVoting(true);
          } else {
            console.debug("UI-Socket: Abstimmung wurde abgelehnt, setze Status zurück");
            collabStore.finishVoting(false);
          }
        });
        break;

      case "showSolution":
        console.debug("UI-Socket: Musterlösung anzeigen", message);
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

const showVotingDialog = (groupId: number, votingRound: number) => {
  console.debug("erzeuge Voting-Dialog");
  Dialog.create({
    component: SubmitPermissionDialog,
    componentProps: {
      // Keine Props nötig
    }
  }).onOk((vote: "accepted" | "rejected") => {
    console.debug(`[UI-Socket] Dialog-Vote erhalten: ${vote}`);
    import("stores/collaborationStore").then(({ useCollaborationStore }) => {
      const collabStore = useCollaborationStore();
      console.debug("[UI-Socket] CollaborationStore geladen, myUserId:", collabStore.myUserId);
      console.debug("[UI-Socket] Verfügbare Parameter:", { groupId, userId: collabStore.myUserId, vote, votingRound });

      if (collabStore.myUserId) {
        sendVote(groupId, collabStore.myUserId, vote, votingRound);
        console.debug(`[UI-Socket] Stimme gesendet: ${vote} für Runde ${votingRound}`);
      }
    });
  }).onCancel(() => {
    console.debug("[UI-Socket] Dialog abgebrochen, sende 'rejected'");
    import("stores/collaborationStore").then(({ useCollaborationStore }) => {
      const collabStore = useCollaborationStore();
      if (collabStore.myUserId) {
        sendVote(groupId, collabStore.myUserId, "rejected", votingRound);
      }
    });
  });
};

// Verbindungsstatus exportieren
export const useUISocketStatus = () => ({
  connected,
  connecting
});
