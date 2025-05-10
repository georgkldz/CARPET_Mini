// src/stores/collaborationStore.ts
import { defineStore } from "pinia";


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
      console.debug("collabstore, myCollabRoleId aufgerufen");
      if (!this.group || this.myUserId === null) {
        console.debug("Abbruch: Gruppe oder myUserId ist null");
        return null;
      }
      console.debug("Members in der Gruppe:", this.group.members);
      console.debug("Suche nach userId:", this.myUserId);
      const myMember = this.group.members.find((m: GroupMember) => {
        console.debug("Prüfe member:", m, "m.userId === this.myUserId:", m.userId === this.myUserId);
        return m.userId === this.myUserId;
      });
      console.debug("Gefundenes Mitglied:", myMember);

      if (myMember) {
        console.debug("Rolle gefunden:", myMember.collabRoleId);
        return myMember.collabRoleId;
      } else {
        console.debug("Keine Rolle gefunden, gebe null zurück");
        return null;
      }
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
    },

    /** räumt auf, z. B. beim Logout */
    clearGroup() {
      this.group = null;
      this.groupId = null;
      this.myUserId = null;
    },
  },
});
