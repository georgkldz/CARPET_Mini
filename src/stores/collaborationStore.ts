// src/stores/collaborationStore.ts
import { defineStore } from "pinia";
import axios from "axios";
import {useTaskGraphStore } from "stores/taskGraphStore";
import { connectUISocket, disconnectUISocket, notifyShowSolution } from "../services/uiSocketService";


export interface GroupMember {
  userId: number;
  collabRoleId: number;
}

export interface GroupInfo {
  groupId:   number;
  taskId:    number;
  size:      number;
  members:   GroupMember[];        // vollständige Rollenliste
  memberIds: number[];             // Redundanz, aber praktisch
}

export const useCollaborationStore = defineStore("collaborationStore", {
  state: () => ({
    group: null as GroupInfo | null,
    groupId: null as number | null,
    myUserId: null as number | null,
  }),

  getters: {
    inGroup(): boolean { return !!this.group;},

    myCollabRoleId(): number | null {
      if (!this.group || this.myUserId === null) {return null; }
      const myMember = this.group.members.find((m: GroupMember) => {
        return m.userId === this.myUserId;
      });
      if (myMember) {return myMember.collabRoleId;
      } else { return null;    }
    },

    roleOf() {
      return (userId: number): number | null => {
        if (!this.group) return null;
        const member = this.group.members.find(
          (m) => m.userId === userId);
        return member ? member.collabRoleId : null;
      };
    },
  },

  actions: {
    setGroup(g: GroupInfo, myUserId: number) {
      this.group = g;
      this.groupId = g.groupId;
      this.myUserId = myUserId;

      connectUISocket(g.groupId, myUserId).catch((error) => {
        console.error("Fehler beim Verbinden mit dem UI-Socket:", error);
      });
    },

    /** räumt auf, z. B. beim Logout */
    clearGroup() {
      disconnectUISocket();
      this.group = null;
      this.groupId = null;
      this.myUserId = null;
    },

    // Generierung aller relevanten Pfade basierend auf einem Muster
    generateFieldPaths() {
      const roles = ["r0", "r1", "r2", "r3"];
      const fieldTypes = [
        { prefix: "latexInputField", count: 3 },
        { prefix: "inputField", count: 5 }
      ];

      const paths = [];

      roles.forEach(role => {
        fieldTypes.forEach(type => {
          for (let i = 1; i <= type.count; i++) {
            paths.push(`$.nodes.2.components.0.nestedComponents.formComponents.${role}_${type.prefix}${i}.state.fieldValue`);
          }
        });
      });

      // Spezielle Pfade hinzufügen
      paths.push("$.nodes.2.components.0.nestedComponents.extraRightComponents.canvas.state.fieldValue");
      paths.push("$.nodes.2.components.0.nestedComponents.extraRightComponents.explanation.state.fieldValue");
      paths.push("$.nodes.2.components.0.nestedComponents.extraRightComponents.result.state.fieldValue");

      return paths;
    },

    async saveSessionData() {
      if (!this.group || !this.groupId || !this.myUserId) {
        console.error("Kann Session-Daten nicht speichern: Keine Gruppeninformationen");
        return null;
      }

      const taskGraphStore = useTaskGraphStore();
      const taskId = this.group.taskId;

      // Teilnehmerdaten vorbereiten - Array von [roleId, userId] für jeden Teilnehmer
      const memberIds = this.group.members.map(member => [
        member.collabRoleId,
        member.userId
      ]);

      const fieldPaths = this.generateFieldPaths();
      const fieldValues = taskGraphStore.extractValuesByPaths(fieldPaths);

      try {
        // API-Call zum Backend
        const response = await axios.post("http://localhost:3000/api/v1/sessionData", {
          taskId,
          memberIds,
          fieldValues
        });

        // SessionId aus der Antwort extrahieren
        const sessionId = response.data.sessionId;
        console.debug("Session-Daten erfolgreich gespeichert, SessionId: ${sessionId}");

        return sessionId;
      } catch (error) {
        console.error("Fehler beim Speichern der Session-Daten:", error);
        return null;
      }
    },

    async showSampleSolution() {
      console.debug("[Collab] Musterlösung anzeigen");
      const taskGraphStore = useTaskGraphStore();
      const sessionId = await this.saveSessionData();
      console.debug("[Collab] Session-Daten gespeichert, SessionId:", sessionId);

      const currentNodeId = taskGraphStore.currentNode;
      if (currentNodeId !== null) {
        taskGraphStore.setProperty({ path: "$.previousNode", value: currentNodeId });
        const edges = taskGraphStore.getProperty("$.edges") ?? {};
        const next = edges[currentNodeId]?.[0];
        if (next) {
          console.debug("collaborationStore, setzt neuen Node", next);
          taskGraphStore.setProperty({ path: "$.currentNode", value: next });
        }
      }

      if (this.myCollabRoleId === 0 && this.groupId && this.myUserId) {
        // Benachrichtigung an alle anderen Gruppenmitglieder senden
        notifyShowSolution(
          this.groupId,
          this.myUserId,
          this.myCollabRoleId,
          taskGraphStore.previousNode
        );
        console.debug("[Collab] Musterlösungsanzeige an andere Gruppenmitglieder gesendet");
      }
    }
  }
});
