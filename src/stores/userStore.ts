// src/stores/userStore.ts
import { defineStore } from "pinia";
import axios from "axios";
import { useTasksStore } from "stores/tasksStore";
import type { User } from "src/models/User";

// Interface für das Leistungsvermögen
export interface Proficiency {
  taskId: number;
  score: number;
}

export const useUserStore = defineStore("userStore", {
  state: () => ({
    currentUser: null as User | null,
    isAuthenticated: false,
    loading: false,
    errorMessage: null as string | null,
    // Neue Eigenschaft für die Speicherung der Bewertungen
    proficiencies: [] as Proficiency[],
  }),

  getters: {
    userId: (state): number | null => {
      return state.currentUser?.userId ?? null;
    },
    roleId: (state): number | null => {
      return state.currentUser?.role ?? null;
    },
    // Neuer Getter für die Abfrage der Leistungsbewertung
    getProficiencyByTaskId: (state) => (taskId: number) => {
      return state.proficiencies.find((p) => p.taskId === taskId)?.score ?? null;
    },
  },

  actions: {
    async login(email: string, password: string) {
      this.loading = true;
      this.errorMessage = null;

      try {
        const response = await axios.post("http://localhost:3000/api/v1/login", {
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

    // Neue Methode zum Speichern der Leistungsbewertung
    setProficiency(proficiency: Proficiency) {
      // Bestehenden Eintrag suchen und aktualisieren, oder neuen hinzufügen
      const index = this.proficiencies.findIndex(p => p.taskId === proficiency.taskId);
      if (index >= 0) {
        this.proficiencies[index] = proficiency;
      } else {
        this.proficiencies.push(proficiency);
      }

      // Optional: Zum Server senden, falls später gewünscht
      // axios.post("http://localhost:3000/proficiencies", proficiency);

      console.log(`Leistungsvermögen gespeichert: Task ${proficiency.taskId}, Score ${proficiency.score}/8`);
    },
  },
});
