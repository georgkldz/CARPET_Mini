// src/stores/commentStore.ts
import { defineStore } from "pinia";
import axios from "axios";
import { useTaskGraphStore } from "./taskGraphStore";

interface SessionMember {
  userId: number;
  roleId: number;
}

interface SessionData {
  sessionId: number;
  taskId: number;
  timestamp: string;
  taskDescription: string;
  members: SessionMember[];
}

interface SessionDetails {
  sessionId: number;
  taskId: number;
  timestamp: string;
  userInputs: Record<string, unknown>;
}

export const useCommentStore = defineStore("commentStore", {
  state: () => ({
    currentSessionId: null as number | null,
    availableSessions: [] as SessionData[],
    currentSessionDetails: null as SessionDetails | null,
    isLoading: false,
    error: null as string | null
  }),

  getters: {
    currentSession: (state) => {
      if (!state.currentSessionId) return null;
      return state.availableSessions.find(
        (session) => session.sessionId === state.currentSessionId
      );
    },

    // Hilfsfunktion um ein Mitglied anhand der Rolle zu finden
    getMemberByRole: (state) => (sessionId: number, roleId: number) => {
      const session = state.availableSessions.find(s => s.sessionId === sessionId);
      if (!session) return null;

      return session.members.find(m => m.roleId === roleId)?.userId || null;
    }
  },

  actions: {
    setCurrentSessionId(sessionId: number) {
      this.currentSessionId = sessionId;
      // Optional: Lade Details, wenn Session gesetzt wird
      this.fetchSessionDetails(sessionId);
    },

    async fetchUserSessions() {
      const taskGraphStore = useTaskGraphStore();
      const userId = taskGraphStore.getProperty("$.userId");

      if (!userId) {
        this.error = "Benutzer-ID nicht verfügbar";
        return;
      }

      this.isLoading = true;
      this.error = null;

      try {
        const response = await axios.get<SessionData[]>(`http://localhost:3000/api/v1/userSessionsData/${userId}`);
        console.debug("Vom Backend erhaltene Sessions:", response.data);

        this.availableSessions = response.data;
      } catch (error) {
        console.error("Fehler beim Abrufen der Sessions:", error);
        this.error = "Fehler beim Laden der Daten";
      } finally {
        this.isLoading = false;
      }
    },

    async fetchSessionDetails(sessionId: number) {
      if (!sessionId) return;

      try {
        const response = await axios.get<SessionDetails>(`http://localhost:3000/api/v1/sessionData/${sessionId}`);
        this.currentSessionDetails = response.data;
        return response.data;
      } catch (error) {
        console.error(`Fehler beim Laden der Session-Details für ID ${sessionId}:`, error);
        return null;
      }
    },

    async validateSessionId(sessionId: number): Promise<boolean> {
      try {
        await axios.get(`http://localhost:3000/api/v1/sessionData/${sessionId}`);
        return true;
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      } catch (err: any) {
          if (err.response?.status === 404) {
            return false
          }
          console.error("validateSessionId-Netzwerkfehler:", err)
          return false
        }
    }
  }
});
