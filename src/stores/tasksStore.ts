// src/stores/tasksStore.ts
import { defineStore } from "pinia";
import type { Task } from "src/models/Task.js";
import axios from "axios";

export const useTasksStore = defineStore("tasksStore", {
  state: () => ({
    tasks: [] as Task[],
    currentTaskId: null as number | null,
    loading: false,
    error: null as string | null,
  }),

  getters: {
    allTaskIds(state): number[] {
      return state.tasks.map((t) => t.taskId);
    },
    getCurrentTaskId(state): number | null {
      return state.currentTaskId;
    },
    getTaskById: (state) => (id: number) => {
      return state.tasks.find((t) => t.taskId === id);
    },
  },

  actions: {
    async loadTasks() {
      try {
        const response = await axios.get<Task[]>("http://localhost:3000/tasks");
        this.tasks = response.data;
      } catch (error) {
        console.error("Fehler beim Laden der Tasks:", error);
      }
    },

    async determineCurrentTaskForUser(userId: number) {
      // Zuerst alle Tasks laden
      await this.loadTasks();

      // Dann erfrage, welche Tasks der User schon erledigt hat
      try {
        const res = await axios.get(
          `http://localhost:3000/userTasks/${userId}`,
        );
        const completed = res.data as Array<{ userTaskId: number; taskId: number }>;
        const completedTaskIds = completed.map((c) => c.taskId);

        // Alle TaskIds
        const all = this.allTaskIds;
        // Unerledigte
        const unfinishedIds = all.filter((id) => !completedTaskIds.includes(id));

        // Falls vorhanden, nimm die erste
        this.currentTaskId = unfinishedIds.length > 0 ? unfinishedIds[0] : null;
      } catch (error) {
        console.error("Fehler beim Lesen der userTasks:", error);
        this.currentTaskId = null;
      }
    },

    async createTask(newTask: Omit<Task, "taskId">) {
      // Omit: Weil taskId normalerweise von der DB vergeben wird
      try {
        const response = await axios.post<Task>(
          "http://localhost:3000/tasks",
          newTask,
        );
        // Der Server gibt das erstellte Task-Objekt (mit taskId) zurück
        this.tasks.push(response.data);
      } catch (error) {
        console.error("Fehler beim Erstellen der Aufgabe:", error);
        throw error;
      }
    },
  },
});
