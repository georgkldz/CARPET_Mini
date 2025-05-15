// src/stores/collaborationStore.ts
import { defineStore } from "pinia";
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

    showSampleSolution() {
      console.debug("[Collab] Alle zugestimmt – Musterlösung anzeigen");
      const taskGraph = useTaskGraphStore();
      const targetNode = 3;
      taskGraph.setProperty({ path: "$.previousNode", value: taskGraph.currentNode });
      taskGraph.setProperty({ path: "$.currentNode", value: targetNode });

      if (this.myCollabRoleId === 0 && this.groupId && this.myUserId) {
        // Benachrichtigung an alle anderen Gruppenmitglieder senden
        notifyShowSolution(
          this.groupId,
          this.myUserId,
          this.myCollabRoleId,
          taskGraph.previousNode
        );
        console.debug("[Collab] Musterlösungsanzeige an andere Gruppenmitglieder gesendet");
      }
    }
  }
});
