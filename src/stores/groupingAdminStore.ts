import { defineStore } from "pinia";
import axios from "axios";

const API = "http://localhost:3000/api/v1";

export interface WaitingUser {
  userId: number;
  taskId: number;
  score: number;
  nickname: string;
}

export interface RemoteGroup {
  groupId: number;
  taskId: number;
  size: number;
  members: { userId: number; collabRoleId: number; nickname: string }[];
  memberIds?: number[];
}

export interface GroupDistribution {
  groups3: number;
  groups4: number;
  total: number;
}

export interface GroupingStatus {
  total: number;
  distribution: GroupDistribution;
  formed: { groups3: number; groups4: number };
  pending: WaitingUser[];
  groups: RemoteGroup[];
}

export const useGroupingAdminStore = defineStore("groupingAdmin", {
  state: () => ({
    total: 0,
    distribution: { groups3: 0, groups4: 0, total: 0 } as GroupDistribution,
    formed: { groups3: 0, groups4: 0 },
    pending: [] as WaitingUser[],
    groups: [] as RemoteGroup[],
    loading: false,
    autoRefreshInterval: null as ReturnType<typeof setInterval> | null,
  }),

  getters: {
    pendingByTask: (state) => {
      const grouped = new Map<number, WaitingUser[]>();
      state.pending.forEach(user => {
        const taskUsers = grouped.get(user.taskId) || [];
        taskUsers.push(user);
        grouped.set(user.taskId, taskUsers);
      });
      return grouped;
    },

    totalFormed: (state) => state.formed.groups3 + state.formed.groups4,

    totalPlanned: (state) => state.distribution.groups3 + state.distribution.groups4,
  },

  actions: {
    async setTotal(n: number) {
      try {
        const { data } = await axios.post(`${API}/grouping/total`, { total: n });
        this.total = data.total;
        this.distribution = data.distribution;
      } catch (error) {
        console.error("Fehler beim Setzen der Teilnehmerzahl:", error);
        throw error;
      }
    },

    async fetchStatus() {
      try {
        this.loading = true;
        const { data } = await axios.get<GroupingStatus>(`${API}/grouping/status`);

        this.total = data.total;
        this.distribution = data.distribution;
        this.formed = data.formed;
        this.pending = data.pending || [];
        this.groups = data.groups || [];

      } catch (error) {
        console.error("Fehler beim Abrufen des Status:", error);
      } finally {
        this.loading = false;
      }
    },

    async manualOverride(groupId: number, userIds: number[], roleIds: number[]) {
      try {
        await axios.post(`${API}/grouping/manual`, { groupId, userIds, roleIds });
        await this.fetchStatus();
      } catch (error) {
        console.error("Fehler bei manueller Gruppierung:", error);
        throw error;
      }
    },

    startAutoRefresh(intervalMs: number = 3000) {
      this.stopAutoRefresh();
      this.autoRefreshInterval = setInterval(() => {
        this.fetchStatus();
      }, intervalMs);
    },

    stopAutoRefresh() {
      if (this.autoRefreshInterval) {
        clearInterval(this.autoRefreshInterval);
        this.autoRefreshInterval = null;
      }
    },
  },
});
