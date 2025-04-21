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
// tasksStore.ts
    async loadTasks() {
      try {
        const rows = await axios.get("http://localhost:3000/tasks");
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        this.tasks = rows.data.map((r: any) => ({
          taskId:      r.taskId,
          description: r.description,
          hint:        r.hint,
          degree:      r.degree,
          symmetry:    r.symmetry,
          solutions: {
            textFieldEquation1:             r.textFieldEquation1,
            textFieldEquation2:             r.textFieldEquation2,
            textFieldEquation3:             r.textFieldEquation3,
            textFieldEquation4:             r.textFieldEquation4,
            textFieldEquation5:             r.textFieldEquation5,
            sampleSolutionCollaborativeWork: r.sampleSolutionCollaborativeWork
          }
        })) as Task[];
      } catch (e) {  }
    }
,

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
