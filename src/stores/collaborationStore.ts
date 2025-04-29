// src/stores/collaborationStore.ts
import { defineStore } from "pinia";

export const useCollaborationStore = defineStore("collaborationStore", {
  state: () => ({
    groupId: null as number | null,
    roleId: null as number | null,
  }),

  actions: {
    // Beispiel: vom Server oder via WebSocket push
    setCollaborationData(groupId: number, roleId: number) {
      this.groupId = groupId;
      this.roleId = roleId;
    },
  },
});
