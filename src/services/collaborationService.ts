// src/services/collaborationService.ts
import axios from "axios";
import { useUserStore } from "stores/userStore";
import { useCollaborationStore } from "stores/collaborationStore";
import { useApplicationStore } from "stores/applicationStore";
import { useTasksStore } from "stores/tasksStore";
import { useTaskGraphStore } from "stores/taskGraphStore";
import type { GroupInfo } from "stores/collaborationStore";

const API_URL = "http://localhost:3000/api/v1";
const STATUS_FALLBACK_DELAY = 9000;

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
  console.debug("collabservice, pollStatusOnce aufgerufen");
  const collab = useCollaborationStore();
  if (collab.inGroup) return;          // SSE war schon erfolgreich

  try {
    const { data } = await axios.get(`${API_URL}/grouping/status`);
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    const myGroup = (data.groups as GroupInfo[]).find((g) =>
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      g.memberIds.includes(myUserId),
    );
    if (myGroup) applyGroupAssignment(myGroup, myUserId);           // ⇐ NEU
  } catch (e) {
    console.error("Status-Fallback fehlgeschlagen:", e);            // ⇐ NEU
  }
}

async function applyGroupAssignment(group: GroupInfo, myUserId: number) {      // ⇐ NEU
  console.debug("collabservice, applyGroupAssignment aufgerufen");
  const collaborationStore = useCollaborationStore();
  const applicationStore = useApplicationStore();
  const taskGraphStore = useTaskGraphStore();
  console.debug("collabservice, empfange Gruppendaten vom Backend ", group);
  collaborationStore.setGroup(group, myUserId);
  console.debug("collabservice, applyGroupAssignment speichert roleId ", collaborationStore.myCollabRoleId);
  taskGraphStore.setProperty({
    path: "$.myCollabRoleId",      // neues Root-Feld
    value: collaborationStore.myCollabRoleId,   // kommt vom Backend
  });
  const currentNodeId = taskGraphStore.currentNode;
  if (currentNodeId !== null) {
    taskGraphStore.setProperty({ path: "$.previousNode", value: currentNodeId });
    const edges = taskGraphStore.getProperty("$.edges") ?? {};
    const next = edges[currentNodeId]?.[0];
    if (next) {
      console.debug("collabservice, collaborationService setzt neuen Node", next);
      await taskGraphStore.setProperty({ path: "$.currentNode", value: next });
    }
  }
  applicationStore.joinSession();


}

/**
 * Richtet einen SSE-Listener ein, der auf Gruppenzuweisungen wartet
 */
function setupSSEListener(myUserId: number): void {
  console.debug("collabservice, setupSSEListener eingerichtet");
  const eventSource = new EventSource(`${API_URL}/events`);

  eventSource.onmessage = (event) => {
    console.debug("collabservice, SSE-Event empfangen");
    try {
      const group: GroupInfo = JSON.parse(event.data);

      if (group.groupId && group.members?.length) {
        applyGroupAssignment(group, myUserId);         // ⇐ ersetzt alten Code
        eventSource.close();
      }
    } catch (err) { console.error("SSE-Fehler:", err); }
  };

  eventSource.onerror = () => {
    console.error("SSE-Verbindung fehlgeschlagen");
    eventSource.close();
  };
}
