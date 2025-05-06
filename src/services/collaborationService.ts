// src/services/collaborationService.ts
import axios from "axios";
import { useUserStore } from "stores/userStore";
import { useCollaborationStore } from "stores/collaborationStore";
import { useApplicationStore } from "stores/applicationStore";
import { useTasksStore } from "stores/tasksStore";
import { useTaskGraphStore } from "stores/taskGraphStore";

const API_URL = "http://localhost:3000/api/v1";
const STATUS_FALLBACK_DELAY = 9000;

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

  // Direkter Zugriff auf tasksStore statt über Getter
  const tasksStore = useTasksStore();
  const taskId = tasksStore.getCurrentTaskId;
  const userId = userStore.userId;

  if (!userId || !taskId) {
    throw new Error("Benutzer-ID oder Aufgaben-ID fehlt");
  }

  // SSE-Verbindung aufbauen, um auf Gruppenzuweisung zu warten
  setupSSEListener(userId);


  // Die zuletzt ermittelte Proficiency abrufen
  const score = userStore.getProficiencyByTaskId(taskId);

  if (score === null) {
    throw new Error("Keine Proficiency für diese Aufgabe vorhanden");
  }

  try {
    console.log(
      `Sende Proficiency an Backend: userId=${userId}, taskId=${taskId}, score=${score}`,
    );

    // Anfrage an den Gruppenbildungs-Endpunkt
    await axios.post(`${API_URL}/grouping/proficiency`, {
      userId,
      taskId,
      score,
    });
    console.log(
      "Proficiency erfolgreich gesendet, warte auf Gruppenzuweisung...",
    );
    setTimeout(() => pollStatusOnce(userId), STATUS_FALLBACK_DELAY);
    return;
  } catch (error) {
    console.error("Fehler beim Beitreten zur Kollaboration:", error);
    throw error;
  }

}

async function pollStatusOnce(myUserId: number) {                  // ⇐ NEU
  const collab = useCollaborationStore();
  if (collab.groupId !== null) return;          // SSE war schon erfolgreich

  try {
    const { data } = await axios.get(`${API_URL}/grouping/status`);
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    const myGroup = data.groups.find((g: any) =>
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      g.members.some((m: any) => m.userId === myUserId)
    );
    if (myGroup) applyGroupAssignment(myGroup, myUserId);           // ⇐ NEU
  } catch (e) {
    console.error("Status-Fallback fehlgeschlagen:", e);            // ⇐ NEU
  }
}

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
function applyGroupAssignment(group: any, myUserId: number) {      // ⇐ NEU
  const collaborationStore = useCollaborationStore();
  const applicationStore   = useApplicationStore();
  const taskGraphStore     = useTaskGraphStore();

  const member = group.members.find((m: GroupMember) => m.userId === myUserId);
  if (!member) return;

  collaborationStore.setCollaborationData(group.groupId, member.roleId);
  taskGraphStore.setProperty({
    path : "$.roleId",      // neues Root-Feld
    value: member.roleId,   // kommt vom Backend
  });
  const currentNodeId = taskGraphStore.currentNode;
  if (currentNodeId !== null) {
    taskGraphStore.setProperty({ path: "$.previousNode", value: currentNodeId });
    const edges = taskGraphStore.getProperty("$.edges") ?? {};
    const next  = edges[currentNodeId]?.[0];
    if (next)   taskGraphStore.setProperty({ path: "$.currentNode", value: next });
  }
  applicationStore.joinSession();


}

/**
 * Richtet einen SSE-Listener ein, der auf Gruppenzuweisungen wartet
 */
function setupSSEListener(userId: number): void {
  const eventSource = new EventSource(`${API_URL}/events`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.groupId && Array.isArray(data.members)) {
        applyGroupAssignment(data, userId);         // ⇐ ersetzt alten Code
        eventSource.close();
      }
    } catch (err) { console.error("SSE-Fehler:", err); }
  };

  eventSource.onerror = () => {
    console.error("SSE-Verbindung fehlgeschlagen");
    eventSource.close();
  };
}
