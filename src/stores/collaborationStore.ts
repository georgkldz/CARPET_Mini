// src/stores/collaborationStore.ts
import { defineStore } from "pinia";
import { SUBMIT_PROPOSAL_PATH } from "stores/sync/automergeSync";
import {useTaskGraphStore } from "stores/taskGraphStore";
import {askForSubmitPermission} from "src/services/submitDialog";

export interface GroupMember {
  userId: number;
  collabRoleId: number;
}

export interface GroupInfo {
  groupId:   number;
  taskId:    number;
  size:      number;
  members:   GroupMember[];        // vollständige Rollenliste
  memberIds: number[];             // Redundanz, aber praktisch
}

export type Vote = "pending" | "accepted" | "rejected"

export interface SubmitProposalDoc {
  round : number;
  votes : Record<number, Vote>;
}


export const useCollaborationStore = defineStore("collaborationStore", {
  state: () => ({
    group: null as GroupInfo | null,
    groupId: null as number | null,
    myUserId: null as number | null,
    currentRound: 0,
    _watcherRegistered: false,
    _unsubscribeHandler: null as (() => void) | null, // Speichert die Unsubscribe-Funktion
    pendingVoteRequest: false,
    submittingProposal: false,
  }),

  getters: {
    inGroup(): boolean { return !!this.group;},

    myCollabRoleId(): number | null {
      if (!this.group || this.myUserId === null) {return null; }
      const myMember = this.group.members.find((m: GroupMember) => {
        return m.userId === this.myUserId;
      });
      if (myMember) {return myMember.collabRoleId;
      } else { return null;    }
    },

    roleOf() {
      return (userId: number): number | null => {
        if (!this.group) return null;
        const member = this.group.members.find(
          (m) => m.userId === userId);
        return member ? member.collabRoleId : null;
      };
    },
  },

  actions: {
    setGroup(g: GroupInfo, myUserId: number) {
      this.group = g;
      this.groupId = g.groupId;
      this.myUserId = myUserId;
      if (!this._watcherRegistered) {
        console.debug("collaborationStore, in setGroup wird watcher registriert");
        const tg = useTaskGraphStore()
        this.watchSubmitProposal(tg)
        this._watcherRegistered = true          // ← einfaches Flag
      }
    },

    /** räumt auf, z. B. beim Logout */
    clearGroup() {
      this.unsubscribe(); // Watcher abmelden, wenn die Gruppe gelöscht wird
      this.group = null;
      this.groupId = null;
      this.myUserId = null;
      this.currentRound = 0;
      this.submittingProposal = false;
    },

    /**
     * Meldet den Watcher ab
     */
    unsubscribe() {
      console.debug("collaborationStore, unsubscribe betreten");
      if (this._unsubscribeHandler) {
        console.debug("collaborationStore, unsubscribehandler aufgerufen");
        this._unsubscribeHandler();
        this._unsubscribeHandler = null;
        this._watcherRegistered = false;
      }
      this.pendingVoteRequest = false;
      this.submittingProposal = false;
    },

    /**
     * Diese Methode kann von einer UI-Komponente aufgerufen werden,
     * wenn der Benutzer eine Benachrichtigung anklickt oder wenn
     * eine "Abstimmen"-Schaltfläche betätigt wird.
     */
    handleVoteRequest() {
      if (!this.pendingVoteRequest) return;


      this.pendingVoteRequest = false;    // Dialog darf nur einmal geöffnet werden
      const taskGraphStore = useTaskGraphStore();

      askForSubmitPermission().then((result) => {
        taskGraphStore.setProperty({
            path: `${SUBMIT_PROPOSAL_PATH}.votes.${this.myUserId}`,
          value: result,
      });
      });
    },

    /**
     * Gibt zurück, ob eine Abstimmungsanfrage aussteht
     */
    hasPendingVoteRequest(): boolean {
      return this.pendingVoteRequest;
    },

    async startSubmitProposal() {
      if (!this.group || this.myUserId == null) return
      if (this.myCollabRoleId !== 0) return;                  // nur Sprecher
      if (this.submittingProposal) return; // Proposal läuft bereits

      this.submittingProposal = true;
      this.currentRound +=1;

      const votes: Record<number, Vote> = {};
      for (const m of this.group.members) {
        votes[m.userId] =
          m.userId === this.myUserId ? "accepted" : "pending";
      }

      const proposal: SubmitProposalDoc = { round: this.currentRound, votes }; // ‹ CHG ›
      const taskGraphStore = useTaskGraphStore();
      taskGraphStore.setProperty({path: SUBMIT_PROPOSAL_PATH, value: proposal});
    },

    /* ➌  Beobachter-Watcher – feuert, sobald ALLE ≠"pending"    */
    watchSubmitProposal(taskGraphStore: ReturnType<typeof useTaskGraphStore>) {
      console.debug("collabStore, watchsubmitproposal betreten");

      // Wenn ein bestehender Watcher existiert, diesen zuerst abmelden
      this.unsubscribe();

      // Neuen Watcher registrieren und Unsubscribe-Handler speichern
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      this._unsubscribeHandler = taskGraphStore.$subscribe((_mutation, _state) => {
        console.debug("collabStore, this.subscribe betreten");
        const sp = taskGraphStore.getProperty(SUBMIT_PROPOSAL_PATH) as
          SubmitProposalDoc | undefined
        if (!sp|| !sp.votes) return;

        // 2a) Mein eigener Vote ist noch offen? → Statt direktem Dialog ein Flag setzen
        const myVote = sp.votes[this.myUserId ?? -1]; // Korrigiert: Zugriff auf votes-Property
        if (myVote === "pending") {
          console.debug("collabStore, myVote ist pending, setze pendingVoteRequest flag");
          this.pendingVoteRequest = true;
          this.handleVoteRequest();
          return;
        }

        const votes = Object.values(sp.votes); // Zugriff auf votes-Property
        if (votes.includes("pending")){
          console.debug("collabStore, votes enthalten pending, weiter beobachten...")
          return
        }

        if (votes.every(v => v === "accepted")) {
          this.showSampleSolution();
          this.unsubscribe(); // Anstelle von resetVoting()
        } else {
          console.debug("collabStore, votes enthalten Ablehnung, abbrechen...");

        }
      });
    },

    /** ➍ Stub für spätere Musterlösungs-Anzeige */
    showSampleSolution() {
      // TODO: TaskPage umschalten / Ergebnisse fetchen etc.
      console.debug("[Collab] Alle zugestimmt – Musterlösung anzeigen");
    }
  }
});
