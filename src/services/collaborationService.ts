// src/services/collaborationService.ts
import axios from "axios";
import { useUserStore } from "stores/userStore";
import { useCollaborationStore } from "stores/collaborationStore";
import { useApplicationStore } from "stores/applicationStore";
import { useTasksStore } from "stores/tasksStore";
import { useTaskGraphStore } from "stores/taskGraphStore";

const API_URL = "http://localhost:3000/api/v1";

// Interface für Gruppenmitglieder
interface GroupMember {
  userId: number;
  roleId: number;
}

/**
 * Sendet die Proficiency an den Grouping-Service und startet den Warteprozess
 */
export async function joinCollaboration(): Promise<void> {
  const userStore = useUserStore();
  const applicationStore = useApplicationStore();

  // Direkter Zugriff auf tasksStore statt über Getter
  const tasksStore = useTasksStore();
  const taskId = tasksStore.getCurrentTaskId;
  const userId = userStore.userId;

  if (!userId || !taskId) {
    throw new Error("Benutzer-ID oder Aufgaben-ID fehlt");
  }

  // Die zuletzt ermittelte Proficiency abrufen
  const score = userStore.getProficiencyByTaskId(taskId);

  if (score === null) {
    throw new Error("Keine Proficiency für diese Aufgabe vorhanden");
  }

  try {
    console.log(`Sende Proficiency an Backend: userId=${userId}, taskId=${taskId}, score=${score}`);

    // Anfrage an den Gruppenbildungs-Endpunkt
    await axios.post(`${API_URL}/grouping/proficiency`, {
      userId,
      taskId,
      score
    });

    console.log("Proficiency erfolgreich gesendet, warte auf Gruppenzuweisung...");

    // Wechsel in den Kollaborationsmodus
    applicationStore.setCollaborationMode(true);

    // SSE-Verbindung aufbauen, um auf Gruppenzuweisung zu warten
    setupSSEListener(userId);

    return;
  } catch (error) {
    console.error("Fehler beim Beitreten zur Kollaboration:", error);
    throw error;
  }
}

/**
 * Richtet einen SSE-Listener ein, der auf Gruppenzuweisungen wartet
 */
function setupSSEListener(userId: number): void {
  const eventSource = new EventSource(`${API_URL}/events`);
  const collaborationStore = useCollaborationStore();
  const applicationStore = useApplicationStore();
  const taskGraphStore = useTaskGraphStore();

  console.log("SSE-Verbindung hergestellt, warte auf Gruppenzuweisung...");

  eventSource.onmessage = (event) => {
    try {
      // Daten aus dem SSE-Event parsen
      const data = JSON.parse(event.data);

      // Prüfen, ob das Event eine Gruppenzuweisung für diesen Benutzer ist
      if (data.groupId && Array.isArray(data.members)) {
        // Typensichere Suche nach dem Benutzer
        const member = data.members.find((m: GroupMember) => m.userId === userId);

        if (member) {
          console.log(`Gruppenzuweisung erhalten: Gruppe ${data.groupId}, Rolle ${member.roleId}`);

          // Daten im collaborationStore speichern
          collaborationStore.setCollaborationData(
            data.groupId, // sessionId = groupId in diesem Fall
            data.groupId,
            member.roleId
          );

          // Verbindung schließen, da keine weiteren Updates benötigt werden
          eventSource.close();

          // TaskPage aktualisieren, damit sie den Kollaborationsmodus anzeigt
          applicationStore.joinSession();

          // *** NEU: Wechsel zum nächsten Node mit Verzögerung ***
          setTimeout(() => {
            // Loading-Zustand aktivieren während des Übergangs
            taskGraphStore.toggleLoading();

            // Aktuellen Node ermitteln (sollte der "groupBuilding"-Node sein)
            const currentNodeId = taskGraphStore.currentNode;

            // Sicherheits-Check
            if (currentNodeId === null) {
              console.error("Aktueller Node ist null, kann nicht zum nächsten Node wechseln!");
              taskGraphStore.toggleLoading();
              return;
            }

            // Als previousNode speichern
            taskGraphStore.setProperty({
              path: "$.previousNode",
              value: currentNodeId
            });

            // Nächsten Node aus der edges-Struktur ermitteln
            const edges = taskGraphStore.getProperty("$.edges");

            if (!edges || !edges[currentNodeId]) {
              console.error(`Keine Edges für Node ${currentNodeId} gefunden!`);
              taskGraphStore.toggleLoading();
              return;
            }

            const nextNodes = edges[currentNodeId];

            if (nextNodes && nextNodes.length > 0) {
              // Zum nächsten Node wechseln (Collaboration-Node)
              taskGraphStore.setProperty({
                path: "$.currentNode",
                value: nextNodes[0]
              });
              console.log(`Node-Wechsel nach Gruppenzuweisung: ${currentNodeId} -> ${nextNodes[0]}`);

              // Nach kurzer Verzögerung den Loading-Status aufheben
              setTimeout(() => {
                taskGraphStore.toggleLoading();
              }, 100);
            } else {
              console.warn(`Kein nächster Node für Node ${currentNodeId} gefunden!`);
              taskGraphStore.toggleLoading();
            }
          }, 50); // Eine kleine Verzögerung vor dem Node-Wechsel
        }
      }
    } catch (error) {
      console.error("Fehler beim Verarbeiten des SSE-Events:", error);
    }
  };

  eventSource.onerror = () => {
    console.error("SSE-Verbindung fehlgeschlagen");
    eventSource.close();
  };
}
