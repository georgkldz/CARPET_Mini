// src/stores/authStore.ts
import { defineStore } from "pinia";
import axios, { AxiosError } from "axios";
import type { User } from "src/models/User.ts";
import { useTasksStore } from "stores/tasksStore";
//import type { Task } from "src/models/Task";

export const useAuthStore = defineStore("authStore", {
  state: () => ({
    currentUser: null as User | null,
    isAuthenticated: false as boolean,
    loading: false as boolean,
    errorMessage: null as string | null,
    currentTask: null as number | null
  }),
  getters: {
    getUserId(state): number | null {
      return state.currentUser?.userId ?? null;
    },
    getRole(state): number | null {
      return state.currentUser?.role ?? null;
    },
    getCurrentTaskId(state): number | null {
      return state.currentTask;
      }
  },
  actions: {
    async login(email: string, password: string) {
      this.loading = true;
      this.errorMessage = null;

      try {
        const response = await axios.post("http://localhost:3000/login", { email, password });
        // Server gibt z. B. { userId, role } zurück
        const { userId, role } = response.data;

        // Baue dir ein User-Objekt
        const user: User = {
          userId,
          email, // Du hast die Email aus dem Login-Form
          password: "", // oder leer, da man es eigentlich nicht speichern sollte
          role
        };

        this.currentUser = user;
        this.isAuthenticated = true;

        // **Tasks laden** und ggf. filtern, welche Aufgaben der User schon bearbeitet hat
        // Du könntest an dieser Stelle z. B. in den tasksStore gehen
        const tasksStore = useTasksStore();
        await tasksStore.loadTasks();

        // Hier dein Endpunkt: /userTasks/:userId
        const resUserTasks = await axios.get(`http://localhost:3000/userTasks/${userId}`);
        const completed: Array<{ userTaskId: number; taskId: number;  }> = resUserTasks.data;

        const completedTaskIds = completed.map((c) => c.taskId);

        // Alle TaskIds aus tasksStore
        const allTaskIds = tasksStore.allTaskIds;
        // => Du implementierst "allTaskIds" im tasksStore-Getter

        // Unerledigte ermitteln:
        const unfinishedIds = allTaskIds.filter((id) => !completedTaskIds.includes(id));

        // Falls was offen: Nimm die erste
        this.currentTask = unfinishedIds.length > 0 ? unfinishedIds[0] : null;

      } catch (error) {
        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError<{ message: string }>;
          this.errorMessage = axiosError.response?.data?.message || "Login fehlgeschlagen.";
        } else {
          this.errorMessage = "Ein unbekannter Fehler ist aufgetreten.";
        }
      } finally {
        this.loading = false;
      }
    },
    logout() {
      this.currentUser = null;
      this.isAuthenticated = false;
      // Ggf. auf Server-Seite noch /logout aufrufen
    }
  }
});
