// src/stores/commentStore.ts
import { defineStore } from "pinia";
import axios from "axios";
import { useTaskGraphStore } from "./taskGraphStore";

interface SessionMember {
  userId: number;
  roleId: number;
  nickname: string;
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

interface Comment {
  id: number;
  sessionId: number;
  fieldId: string;
  userId: number;
  text: string;
  timeStamp: string;
  nickname?: string;
}

export const useCommentStore = defineStore("commentStore", {
  state: () => ({
    currentSessionId: null as number | null,
    availableSessions: [] as SessionData[],
    currentSessionDetails: null as SessionDetails | null,
    isLoading: false,
    error: null as string | null,
    comments: [] as Comment[],
    userNicknames: {} as Record<number, string>,
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
    },

    commentsForField: (state) => (fieldId: string) => {
      return state.comments.filter(c => c.fieldId === fieldId && c.sessionId === state.currentSessionId);
    },
    commentsForSession: (state) => {
      return state.comments.filter(c => c.sessionId === state.currentSessionId);
    },
    getNicknameByUserId: (state) => (userId: number) => {
      return state.userNicknames[userId] || `User ${userId}`;
    },
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
    },

    async fetchCommentsForSession(sessionId: number) {
      try {
        const response = await axios.get<Comment[]>(`http://localhost:3000/api/v1/comments/${sessionId}`);
        this.comments = response.data;

        // Erzeuge Menge aller userIds aus den Kommentaren
        const userIds = [
          ...new Set(this.comments.map(comment => comment.userId))
        ];

        // Lade alle fehlenden Nicknames
        await this.loadNicknamesForUserIds(userIds);
      } catch (error) {
        console.error("Fehler beim Laden der Kommentare:", error);
      }
    },

    async loadNicknamesForUserIds(userIds: number[]) {
      // Nur UserIds laden, die noch nicht im Mapping stehen:
      const idsToFetch = userIds.filter(id => !(id in this.userNicknames));
      if (idsToFetch.length === 0) return;

      try {
        const nicknames = await this.getMultipleUserNicknames(idsToFetch);
        // nicknames ist ein Mapping { "1": "Charlie", ... }
        Object.entries(nicknames).forEach(([id, nickname]) => {
          this.userNicknames[Number(id)] = nickname;
        });
      } catch (error) {
        console.error("Fehler beim Abrufen der Nicknames:", error);
      }
    },

    // Deine Methoden für Backend-Requests (kannst du auch separat halten)
    async getMultipleUserNicknames(userIds: number[]): Promise<Record<number, string>> {
      if (userIds.length === 0) return {};
      try {
        const userIdsString = userIds.join(",");
        const response = await axios.get<Record<number, string>>(
          `http://localhost:3000/api/v1/users/nicknames?userIds=${userIdsString}`
        );
        return response.data;
      } catch (error) {
        console.error("Fehler beim Abrufen der Nicknames:", error);
        return {};
      }
    },

    async addComment({ sessionId, fieldId, userId, text }: { sessionId: number, fieldId: string, userId: number, text: string }) {
      // timeStamp vom Backend oder hier erzeugen:
      const timeStamp = new Date().toISOString();
      try {
        const response = await axios.post<Comment>(
          `http://localhost:3000/api/v1/comments/`,
          { sessionId, fieldId, userId, text, timeStamp }
        );
        // Falls das Backend den endgültigen Kommentar mit id zurückgibt:
        this.comments.push(response.data);
      } catch (error) {
        console.error("Fehler beim Hinzufügen des Kommentars:", error);
        // this.error = "Fehler beim Speichern des Kommentars";
      }
    }

  }
});
