// src/stores/tasksStore.ts
import { defineStore } from "pinia";
import type { Task } from "src/models/Task.ts";
import axios from "axios";

export const useTasksStore = defineStore("tasksStore", {
  state: () => ({
    tasks: [] as Task[]
  }),
  getters: {
    // Optional: z. B. gefilterte Listen oder einzelne Task-Finder
    getTaskById: (state) => {
      return (id: number) => state.tasks.find((t) => t.taskId === id);
    },
    allTaskIds: (state) => {
      return state.tasks.map((t) => t.taskId);
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
    async createTask(newTask: Omit<Task, "taskId">) {
      // Omit: Weil taskId normalerweise von der DB vergeben wird
      try {
        const response = await axios.post<Task>("http://localhost:3000/tasks", newTask);
        // Der Server gibt das erstellte Task-Objekt (mit taskId) zurück
        this.tasks.push(response.data);
      } catch (error) {
        console.error("Fehler beim Erstellen der Aufgabe:", error);
        throw error;
      }
    }
  }
});

