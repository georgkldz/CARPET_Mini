// src/stores/commentStore.ts
import { defineStore } from "pinia";
import axios from "axios";
import { useTaskGraphStore } from "./taskGraphStore";
import {Comment} from "../models/Comment"

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
  collaborationNodes: Record<string, unknown>;
  taskData: Record<string, unknown>;
  members:   SessionMember[];
}

// NEU: Eine Schnittstelle für die Benutzerdetails, die Rolle und Nickname enthält.
interface UserDetails {
  nickname: string;
  role: number;
}

export const useCommentStore = defineStore("commentStore", {
  state: () => ({
    currentSessionId: null as number | null,
    availableSessions: [] as SessionData[],
    currentSessionDetails: null as SessionDetails | null,
    isLoading: false,
    error: null as string | null,
    comments: [] as Comment[],
    userDetails: {} as Record<number, UserDetails>,
    socket: null as WebSocket | null,
  }),

  getters: {
    currentSession: (state) => {
      if (!state.currentSessionId) return null;
      return state.availableSessions.find(
        (session) => session.sessionId === state.currentSessionId
      );
    },

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
    // GEÄNDERT: Dieser Getter gibt weiterhin nur den Nickname zurück, greift aber auf die neue Struktur zu.
    getNicknameByUserId: (state) => (userId: number) => {
      return state.userDetails[userId]?.nickname || `User ${userId}`;
    },

    getFormattedNicknameByUserId: (state) => (userId: number) => {
      const details = state.userDetails[userId];
      if (!details) {
        return `User ${userId}`;
      }
      const roleText = details.role === 1 ? "Studierender" : "Lehrender";
      return `${details.nickname} (${roleText})`;
    },

    visibleCommentsForSession(state): Comment[] {
      if (!state.currentSessionId) return [];

      const taskGraphStore  = useTaskGraphStore();
      const currentUserId   = taskGraphStore.userId!;
      const currentUserRole = state.userDetails[currentUserId]?.role ?? 1; // 2 = Lehrender

      // Alle Teilnehmer dieser Session
      const memberIds = new Set(
        state.currentSessionDetails?.members.map(m => m.userId) ?? []
      );

      return state.comments.filter(c => {
        const authorRole = state.userDetails[c.userId]?.role ?? 1; // 1 = Stud.

        /* ─────────────────── STUDIERENDEN-KOMMENTAR (Role 1) ─────────────────── */
        if (authorRole === 1) {
          // Kommentare von Studierenden dürfen immer angezeigt werden
          return true;
        }

        /* ───────────────────── LEHRENDEN-KOMMENTAR (Role 2) ──────────────────── */
        if (authorRole === 2) {
          // Lehrende sehen alle Kommentare
          if (currentUserRole === 2) return true;

          // Studierende sehen Lehrer-Kommentare nur,
          // wenn sie an dieser Session beteiligt waren
          return memberIds.has(currentUserId);
        }

        /* ───────────────────── Andere/unbekannte Rollen ─────────────────────── */
        return false; // sicherheitshalber ausfiltern
      });
    },

  },

  actions: {
    initWebSocket() {
      const taskGraphStore = useTaskGraphStore();
      const userId = taskGraphStore.userId;
      const sessionId = this.currentSessionId;

      if (this.socket || !userId || !sessionId) {
        return;
      }
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const hostname = window.location.hostname;
      const url = `${protocol}//${hostname}:3000/ui-events`;

      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        console.log("WebSocket-Verbindung im Store geöffnet.");

        this.socket?.send(JSON.stringify({
          type: "register",
          groupId: sessionId.toString(),
          userId: userId,
        }));
      };
      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "newCommentBroadcast") {
          const newComment: Comment = data.comment;
          console.log("Neuer Kommentar von anderem Client empfangen:", newComment);

          this.comments.push(newComment);
          if (!this.userDetails[newComment.userId]) {
            console.log(`... Lade fehlende User-Details für User-ID: ${newComment.userId}`);
            this.loadUserDetailsForUserIds([newComment.userId]);
          }
        }
      };

      this.socket.onclose = () => {
        console.log("WebSocket-Verbindung im Store geschlossen.");
        this.socket = null;
      };
    },

    disconnectWebSocket() {
      if (this.socket) {
        this.socket.close();
      }
    },

    setCurrentSessionId(sessionId: number) {
      this.currentSessionId = sessionId;
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
        this.currentSessionId = sessionId;

        const userIds = [...new Set(this.comments.map(comment => comment.userId))];
        await this.loadUserDetailsForUserIds(userIds);

        // NEU: WebSocket initialisieren, nachdem die Session-Daten geladen sind.
        this.initWebSocket();

      } catch (error) {
        console.error("Fehler beim Laden der Kommentare:", error);
      }
    },

    // GEÄNDERT: Lädt die Details (Nickname + Rolle) und speichert sie im neuen State.
    async loadUserDetailsForUserIds(userIds: number[]) {
      const idsToFetch = userIds.filter(id => !(id in this.userDetails));
      if (idsToFetch.length === 0) return;

      try {
        const userDetails = await this.getMultipleUserDetails(idsToFetch);
        Object.entries(userDetails).forEach(([id, details]) => {
          this.userDetails[Number(id)] = details;
        });
      } catch (error) {
        console.error("Fehler beim Abrufen der Benutzerdetails:", error);
      }
    },

    async getMultipleUserDetails(userIds: number[]): Promise<Record<number, UserDetails>> {
      if (userIds.length === 0) return {};
      try {
        const userIdsString = userIds.join(",");
        // WICHTIG: Das Backend muss hier ein Objekt wie { "1": { "nickname": "Alice", "role": 1 } } zurückgeben.
        const response = await axios.get<Record<number, UserDetails>>(
          `http://localhost:3000/api/v1/users/nicknames?userIds=${userIdsString}`
        );
        return response.data;
      } catch (error) {
        console.error("Fehler beim Abrufen der Benutzerdetails:", error);
        return {};
      }
    },

    async addComment({ sessionId, fieldId, userId, text }: { sessionId: number, fieldId: string, userId: number, text: string }): Promise<Comment | null> {
      const timeStamp = new Date().toISOString();
      try {
        const response = await axios.post<Comment>(
          `http://localhost:3000/api/v1/comments/`,
          { sessionId, fieldId, userId, text, timeStamp }
        );
        const newComment = response.data;
        this.comments.push(newComment);

        // NEU: Sende den neuen Kommentar über den WebSocket an andere.
        if (this.socket?.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({
            type: "newComment",
            groupId: this.currentSessionId?.toString(),
            userId: userId,
            comment: newComment,
          }));
        }

        return newComment;

      } catch (error) {
        console.error("Fehler beim Hinzufügen des Kommentars:", error);
        return null;
      }
    },
  }
});
