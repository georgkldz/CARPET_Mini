// src/stores/collaborationStore.ts
import { defineStore } from "pinia";

export const useCollaborationStore = defineStore("collaborationStore", {
  state: () => ({
    sessionId: null as number | null,
    groupId: null as number | null,
    roleId: null as number | null,
  }),

  actions: {
    // Beispiel: vom Server oder via WebSocket push
    setCollaborationData(sessionId: number, groupId: number, roleId: number) {
      this.sessionId = sessionId;
      this.groupId = groupId;
      this.roleId = roleId;
    },
  },
});
