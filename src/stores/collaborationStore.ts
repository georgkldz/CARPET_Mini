// src/stores/collaborationStore.ts
import { defineStore } from "pinia";
import axios from "axios";
import { Role, useTaskGraphStore } from "stores/taskGraphStore";
import {  connectUISocket, disconnectUISocket, notifyShowSolution, notifySubmitProposal  } from "../services/uiSocketService";
import { leaveSession, softResetSession } from "stores/sync/automergeSync";
import { resetSSEListener } from "src/services/collaborationService";
import { SerialisedNodes } from "stores/applicationStore";
import { NestedComponents, SerializedBaseComponent } from "carpet-component-library";


export interface GroupMember {
  userId: number;
  collabRoleId: number;
  nickname: string;
}

export interface GroupInfo {
  groupId:   number;
  taskId:    number;
  size:      number;
  members:   GroupMember[];        // vollständige Rollenliste
  memberIds: number[];             // Redundanz, aber praktisch
}

export interface RoleInfo {
  roleId: number;
  name: string;
  description: string;
  writeAccess: string[];
  colorHex: string;
}

export const useCollaborationStore = defineStore("collaborationStore", {
  state: () => ({
    group: null as GroupInfo | null,
    groupId: null as number | null,
    myUserId: null as number | null,
    roleInfos: {} as Record<number, RoleInfo>,
    currentVotingRound: 0,
    isVotingInProgress: false,
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
      this.setRoleInfos();
      connectUISocket(g.groupId, myUserId).catch((error) => {
        console.error("Fehler beim Verbinden mit dem UI-Socket:", error);
      });
    },

    // Im collaborationStore
    setRoleInfos() {
      const taskGraphStore = useTaskGraphStore();
      const rolesData = taskGraphStore.getProperty("$.roles") as Record<number, Role>;
      console.debug("Rollesarray aus dem taskGraphStore", rolesData);
      console.debug("Type aus dem taskGraphStore", typeof rolesData);
      console.debug("Is Array:", Array.isArray(rolesData));

      const defaultColor = "#6b7280";
      const transformedRoles: Record<number, RoleInfo> = {};

      // Prüfe auf Object mit numerischen Keys statt auf Array
      if (rolesData && typeof rolesData === "object") {
        console.debug("Object-Struktur erkannt, verarbeite Keys:", Object.keys(rolesData));

        Object.entries(rolesData).forEach(([key, role]: [string, Role]) => {
          const index = parseInt(key);

          if (!isNaN(index) && role && typeof role === "object") {
            transformedRoles[index] = {
              roleId: index,
              name: role.name || "",
              description: role.description || "",
              writeAccess: role.writeAccess || [],
              colorHex: role.colorHex || defaultColor
            };
            console.debug("Geparste Rolle", index, transformedRoles[index]);
          }
        });
      }

      this.roleInfos = transformedRoles;
      console.debug("Loaded roles:", this.roleInfos);
    },

    async clearGroup() {
      console.debug("[Collab] Starte Cleanup der Gruppe mit Soft-Reset");
      resetSSEListener();

      try {
        await axios.post("http://localhost:3000/api/v1/grouping/leave", {
          userId: this.myUserId
        });
        console.debug("[Collab] Backend über Gruppenverlassen informiert");
      } catch (error) {
        console.error("[Collab] Fehler beim Informieren des Backends:", error);
      }

      disconnectUISocket();
      if (this.groupId) {
        const resetSuccess = await softResetSession(this.groupId);
        if (resetSuccess) {
          console.debug("[Collab] Server Soft-Reset erfolgreich für Gruppe:", this.groupId);
        } else {
          console.error("[Collab] Server Soft-Reset fehlgeschlagen");
        }
      }
      await leaveSession();
      const taskGraphStore = useTaskGraphStore();
      taskGraphStore.clearSinglePhaseValues();
      this.clearCollaborationInputs();
      this.group = null;
      this.groupId = null;
      this.myUserId = null;
      this.currentVotingRound = 0;
      this.isVotingInProgress = false;
      this.roleInfos = {};
    },

    // generateFieldPaths() {
    //   const roles = ["r0", "r1", "r2", "r3"];
    //   const fieldTypes = [
    //     { prefix: "latexInputField", count: 3 },
    //     { prefix: "inputField", count: 5 }
    //   ];
    //
    //   const paths = [];
    //
    //   roles.forEach(role => {
    //     fieldTypes.forEach(type => {
    //       for (let i = 1; i <= type.count; i++) {
    //         paths.push(`$.nodes.2.components.0.nestedComponents.formComponents.${role}_${type.prefix}${i}.state.fieldValue`);
    //       }
    //     });
    //   });
    //
    //   // Spezielle Pfade hinzufügen
    //   paths.push("$.nodes.2.components.0.nestedComponents.extraRightComponents.canvas.state.fieldValue");
    //   paths.push("$.nodes.2.components.0.nestedComponents.extraRightComponents.explanation.state.fieldValue");
    //   paths.push("$.nodes.2.components.0.nestedComponents.extraRightComponents.result.state.fieldValue");
    //
    //   return paths;
    // },
    //
    // // In den actions des useCollaborationStore
    // resetFields() {
    //   const taskGraphStore = useTaskGraphStore();
    //   const fieldPaths = this.generateFieldPaths();
    //
    //   // Rufe die neue resetValuesByPath-Methode im taskGraphStore auf
    //   taskGraphStore.resetValuesByPath(fieldPaths);
    //   console.debug("[Collab] Alle Kollaborationsfelder wurden zurückgesetzt");
    // },

    collectPaths(
      basePath: string,                        // aktueller JSONPath-Prefix
      node: SerializedBaseComponent | NestedComponents,
      transferKeys: string[],
      out: string[]
    ) {
      // Fall A: echtes Component-Objekt (enthält "type")
      if ((node as SerializedBaseComponent).type) {
        const comp = node as SerializedBaseComponent;
        if (comp.componentConfiguration?.isCommentable === true) {
          const stateObj = comp.state as Record<string, unknown>;
          transferKeys
            .filter((k) => k in stateObj)
            .forEach((k) => out.push(`${basePath}.state.${k}`));
        }
        return;
      }

      // Fall B: weiterer Container – rekursiv tiefer gehen
      const container = node as NestedComponents;
      Object.entries(container).forEach(([childKey, childVal]) => {
        this.collectPaths(
          `${basePath}.${childKey}`,
          childVal as SerializedBaseComponent | NestedComponents,
          transferKeys,
          out
        );
      });
    },

    /**  Haupt­aktion: setzt alle synchronisierbaren Felder der Kollaborations­phase auf ""  */
    clearCollaborationInputs() {
      const taskGraphStore = useTaskGraphStore();
      const nodes = taskGraphStore.getProperty("$.nodes") as SerialisedNodes;

      /* ---------- 1) Collaboration-Node finden ------------------------- */
      const collabEntry = Object.entries(nodes).find(
        ([, n]) => n.collaboration?.mode === "collaboration"
      );
      if (!collabEntry) {
        console.warn("[Collab] Kein Node mit mode=collaboration gefunden");
        return;
      }
      const [collabKey, collabNode] = collabEntry;

      /* ---------- 2) transferKeys bestimmen ---------------------------- */
      const transferKeys =
        collabNode.collaboration?.transferToCollab?.length
          ? collabNode.collaboration.transferToCollab
          : ["fieldValue"]; // Fallback
      const pathsToClear: string[] = [];

      /* ---------- 3) Rekursiv durch alle Components -------------------- */
      const components = taskGraphStore.getProperty(
        `$.nodes.${collabKey}.components`
      ) as Record<string, unknown>;

      Object.keys(components).forEach((cid) => {
        const nestedRoot = taskGraphStore.getProperty(
          `$.nodes.${collabKey}.components.${cid}.nestedComponents`
        ) as NestedComponents;

        this.collectPaths(
          `$.nodes.${collabKey}.components.${cid}.nestedComponents`,
          nestedRoot,
          transferKeys,
          pathsToClear
        );
      });

      /* ---------- 4) Batch-Reset via taskGraphStore -------------------- */
      if (pathsToClear.length) {
        taskGraphStore.resetValuesByPath(pathsToClear);
        console.debug(
          `[Collab] ${pathsToClear.length} Kollaborations­felder geleert`
        );
      } else {
        console.debug("[Collab] Keine Felder zu leeren gefunden");
      }
    },


    async saveSessionData() {
      if (!this.group || !this.groupId || !this.myUserId) {
        console.error("Kann Session-Daten nicht speichern: Keine Gruppeninformationen");
        return null;
      }

      const taskGraphStore = useTaskGraphStore();
      const taskId = this.group.taskId;

      // Teilnehmerdaten vorbereiten - Array von [roleId, userId] für jeden Teilnehmer
      const memberIds = this.group.members.map(member => [
        member.collabRoleId,
        member.userId
      ]);

      // Anstelle von fieldValues: Alle Collaboration-Knoten extrahieren
      const sessionData = taskGraphStore.extractSessionData();

      try {
        // API-Call zum Backend
        const response = await axios.post("http://localhost:3000/api/v1/sessionData", {
          taskId,
          memberIds,
          sessionData
        });

        // SessionId aus der Antwort extrahieren
        const sessionId = response.data.sessionId;
        console.debug(`Session-Daten erfolgreich gespeichert, SessionId: ${sessionId}`);

        return sessionId;
      } catch (error) {
        console.error("Fehler beim Speichern der Session-Daten:", error);
        return null;
      }
    },

    startSubmitProposal() {
      console.debug("[Collab] Abstimmung für Musterlösung starten");

      // Nur der Gruppensprecher kann eine Abstimmung starten
      if (this.myCollabRoleId !== 0) {
        console.warn("[Collab] Nur der Gruppensprecher kann eine Abstimmung starten");
        return;
      }
      if (!this.groupId || !this.myUserId) {
        console.error("[Collab] Keine Gruppen- oder Benutzer-ID verfügbar");
        return;
      }
      if (this.isVotingInProgress) {
        console.debug("[Collab] Eine Abstimmung ist bereits im Gange");
        return;
      }

      // Abstimmungsrunde erhöhen
      this.currentVotingRound++;
      this.isVotingInProgress = true;

      // Abstimmungsvorschlag über WebSocket senden
      const success = notifySubmitProposal(
        this.groupId,
        this.myUserId,
        this.myCollabRoleId,
        this.currentVotingRound
      );

      if (success) {
        console.debug(`[Collab] Abstimmungsrunde ${this.currentVotingRound} gestartet`);
      } else {
        console.error("[Collab] Fehler beim Senden der Abstimmungsanfrage");
        this.isVotingInProgress = false;
      }
    },

    finishVoting(approved: boolean) {
      this.isVotingInProgress = false;

      if (approved) {
        console.debug("[Collab] Abstimmung erfolgreich, zeige Musterlösung an");
        this.showSampleSolution();
      } else {
        console.debug("[Collab] Abstimmung abgelehnt, neue Abstimmung möglich");
      }
    },

    async showSampleSolution() {
      console.debug("[Collab] Musterlösung anzeigen");
      const taskGraphStore = useTaskGraphStore();
      const sessionId = await this.saveSessionData();
      console.debug("[Collab] Session-Daten gespeichert, SessionId:", sessionId);

      const currentNodeId = taskGraphStore.currentNode;
      if (currentNodeId !== null) {
        taskGraphStore.setProperty({ path: "$.previousNode", value: currentNodeId });
        const edges = taskGraphStore.getProperty("$.edges") ?? {};
        const next = edges[currentNodeId]?.[0];
        if (next) {
          console.debug("collaborationStore, setzt neuen Node", next);
          taskGraphStore.setProperty({ path: "$.currentNode", value: next });
        }
      }

      if (this.myCollabRoleId === 0 && this.groupId && this.myUserId) {
        // Benachrichtigung an alle anderen Gruppenmitglieder senden
        notifyShowSolution(
          this.groupId,
          this.myUserId,
          this.myCollabRoleId,
          taskGraphStore.previousNode
        );
        console.debug("[Collab] Musterlösungsanzeige an andere Gruppenmitglieder gesendet");
      }
    }
  }
});
