// src/stores/userStore.ts
import { defineStore } from "pinia";
import axios from "axios";
import {useTasksStore} from "stores/tasksStore";
import type { User } from "src/models/User";

export const useUserStore = defineStore("userStore", {
  state: () => ({
    currentUser: null as User | null,
    isAuthenticated: false,
    loading: false,
    errorMessage: null as string | null,
  }),

  getters: {
    userId: (state): number | null => {
      return state.currentUser?.userId ?? null;
    },
    roleId: (state): number | null => {
      return state.currentUser?.role ?? null;
    },
  },

  actions: {
    async login(email: string, password: string) {
      this.loading = true;
      this.errorMessage = null;

      try {
        const response = await axios.post("http://localhost:3000/login", {
          email,
          password,
        });
        // Beispielserver gibt { userId, role } zurück
        const { userId, role } = response.data;

        // Baue ein User-Objekt
        const user: User = {
          userId,
          email,
          password: "", // optional
          role,
        };

        this.currentUser = user;
        this.isAuthenticated = true;

        const tasksStore = useTasksStore();
        await tasksStore.determineCurrentTaskForUser(userId);
      } catch (error) {
        this.errorMessage = "Login fehlgeschlagen.";
        console.error(error);
      } finally {
        this.loading = false;
      }
    },

    logout() {
      this.currentUser = null;
      this.isAuthenticated = false;
      this.loading = false;
      this.errorMessage = null;
      // Ggf. Server-Logout
      // axios.post("http://localhost:3000/logout");
    },
  },
});
