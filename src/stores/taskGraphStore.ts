import { defineStore } from "pinia";
import type { StateTree } from "pinia";
import { SerialisedNodes, useApplicationStore } from "./applicationStore";
import type { AvailableTasks } from "./applicationStore";
import type { SerialisedTask } from "./applicationStore";
import { JSONPath } from "jsonpath-plus";
import { syncSingleComponentChange } from "stores/sync/automergeSync";
import type { Task } from "src/models/Task";

import type {
  StoreAPI,
  JSONPathExpression,
  StoreSetterPayload, NestedComponents, SerializedBaseComponent
} from "carpet-component-library";

import { useTasksStore } from "stores/tasksStore";
import { nextTick } from "vue";
import { useCommentStore } from "stores/commentStore";

export interface EventLog {
  interactionEvents: Array<object>;
  mouseEvents: Array<object>;
  panningEvents: Array<object>;
  zoomingEvents: Array<object>;
  metaData: object;
}

export interface Role {
  name: string;
  description: string;
  writeAccess: string[];
  colorHex: string;
}

export interface CARPETStoreAPI extends StoreAPI {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface TaskGraphState extends SerialisedTask {
  applyingRemote: boolean;
  isPromotingToCollab: boolean;
  isCommentMode: boolean;
  userId: number | undefined;
  myCollabRoleId: number | undefined;
  currentTask: string | null;
  isLoading: boolean;
  currentNode: number | null;
  previousNode: number | null;
  replayLog: EventLog;
  roles: Record<number, Role>;
}

export type TaskGraphStateKey = keyof TaskGraphState;

/**
 * The taskGraphStore has to be defined with the Options-API,
 * as `this.$state` is not available for actions in the Setup-API.
 */
export const useTaskGraphStore = defineStore("taskGraphStore", {
  state: (): TaskGraphState => ({
    userId: undefined,
    myCollabRoleId: undefined,
    currentTask: null,
    isLoading: false,
    currentNode: null,
    previousNode: null,
    applyingRemote: false,
    isCommentMode: false,
    isPromotingToCollab: false,
    roles: {},
    taskData: {},
    replayLog: {
      interactionEvents: [],
      mouseEvents: [],
      panningEvents: [],
      zoomingEvents: [],
      metaData: {},
    },
    feedbackLevel: "none",
    layoutSize: "desktop",
    rootNode: 0,
    nodes: {},
    edges: {},
  }),
  getters: {
    getPropertyFromPath: (state) => (path: JSONPathExpression) => {
      if (typeof path !== "string") {
        throw new Error(`Path is not a string: ${path}`);
      }
      const result = JSONPath({ path: path, json: state });
      if (result.length === 1) return result[0];
      return result;
    },
    getCurrentNode: (state) => {
      return state.nodes[state.currentNode as number];
    },

    getCurrentCollaborationMode: (
      state: TaskGraphState,
    ): "single" | "groupBuilding" | "collaboration" | "solutionView"=> {
      if (state.currentNode === null) return "single";
      return state.nodes[state.currentNode]?.collaboration?.mode ?? "single";
    },
    // Ruft den Getter aus dem authStore auf, der die ID der aktuellen Aufgabe liefert
    getCurrentTaskId( state: TaskGraphState,): number | null {
      return state.taskData?.taskId;
    },
  },

  actions: {
    /**
     * Extra-Action, um den Task aus der DB (bzw. tasksStore) zu laden
     * und bestimmte Felder in das JSON des SerialisedTask zu schreiben
     * (z.B. description, hint, etc.).
     */
    loadDBTaskIntoGraph() {
      console.log("loadDBTaskIntoGraph gestartet");
      // 1. Task-ID holen
      const taskId = this.getCurrentTaskId;
      if (!taskId) {
        console.warn("Keine aktuelle Task-ID definiert.");
        return;
      }
      console.log("currentTaskId ist ", taskId);
      // 2. tasksStore importieren + Task finden
      const tasksStore = useTasksStore();
      const foundTask: Task | undefined = tasksStore.getTaskById(taskId);
      if (!foundTask) {
        console.warn(`Task mit ID=${taskId} nicht im tasksStore gefunden.`);
        return;
      }

      // 3. Gewünschte Felder in den "taskGraphState" schreiben,
      //    z. B. an JSON-Pfade für description/hint
      //  (Passe diese Pfade an deine JSON-Struktur an!)
      this.setProperty({
        path: "$.nodes.0.components.0.nestedComponents.formComponents.textView1.state.textSegments[0].text",
        value: foundTask.description,
      });
      this.setProperty({
        path: "$.nodes.2.components.0.nestedComponents.formComponents.textView1.state.textSegments[0].text",
        value: foundTask.description,
      });
      this.setProperty({
        path: "$.nodes.3.components.5.nestedComponents.formComponents.textView1.state.textSegments[0].text",
        value: foundTask.description,
      });
      this.setProperty({
        path: "$.taskData.taskDescription",
        value: foundTask.description,
      });
      this.setProperty({
        path: "$.taskData.hint",
        value: foundTask.hint ?? "",
      });
      // Im loadDBTaskIntoGraph():
      this.setProperty({
        path: "$.taskData.degree",
        value: foundTask.degree,
      });
      this.setProperty({
        path: "$.taskData.symmetry",
        value: foundTask.symmetry,
      });
      this.setProperty({
        path: "$.taskData.solutions.textFieldEquation1",
        value: foundTask.solutions?.textFieldEquation1 ?? "",
      });
      this.setProperty({
        path: "$.taskData.solutions.textFieldEquation2",
        value: foundTask.solutions?.textFieldEquation2 ?? "",
      });
      this.setProperty({
        path: "$.taskData.solutions.textFieldEquation3",
        value: foundTask.solutions?.textFieldEquation3 ?? "",
      });
      this.setProperty({
        path: "$.taskData.solutions.textFieldEquation4",
        value: foundTask.solutions?.textFieldEquation4 ?? "",
      });
      this.setProperty({
        path: "$.taskData.solutions.textFieldEquation5",
        value: foundTask.solutions?.textFieldEquation5 ?? "",
      });
      this.setProperty({
        path: "$.taskData.solutions.sampleSolutionCollaborativeWork",
        value: foundTask.solutions?.sampleSolutionCollaborativeWork ?? "",
      });

      // Ggf. weitere Felder
      console.log("loadDBTaskIntoGraph: Task übernommen:", foundTask);
    },

    /**
     * Diese Methode sucht automatisch:
     *  - den Node mit `collaboration.mode === "single"`
     *  - den Node mit `collaboration.mode === "collaboration"`
     * Dann kopiert sie für jede NestedComponent, die:
     *  - `componentConfiguration.isCommentable === true`
     *  - für jeden key in `transferToCollab` (z.B. ["fieldValue"])
     * den Wert aus dem Single-Knoten in den Collaboration-Knoten unter dem Präfix `r{roleId}_`.
     */
    /**
     * Überträgt alle in `transferToCollab` aufgelisteten State-Felder
     * von den kommentierbaren Nested-Components des SINGLE-Knotens
     * in den COLLABORATION-Knoten unter r{roleId}_<compId>.
     *
     * Erwartet:
     *  - Jeder Node, der kopiert werden soll, hat unter
     *      collaboration.mode            "single" | "collaboration"
     *      collaboration.transferToCollab string[]
     *  - Nur Komponenten mit
     *      componentConfiguration.isCommentable === true
     *    werden berücksichtigt.
     */
    async transferStateValuesToCollab() {
      /* ----------------------------------------------------------
       * 1) Warten bis der TaskGraph geladen ist
       * -------------------------------------------------------- */
      while (!this.getProperty("$.documentReady")) {
        await nextTick();
      }

      /* ----------------------------------------------------------
       * 2) Knoten bestimmen
       * -------------------------------------------------------- */
      const allNodes = this.getProperty("$.nodes") as SerialisedNodes;

      let srcNodeKey: string | null = null;
      let dstNodeKey: string | null = null;

      for (const [key, node] of Object.entries(allNodes)) {
        switch (node.collaboration?.mode) {
          case "single":
            srcNodeKey = key;
            break;
          case "collaboration":
            dstNodeKey = key;
            break;
        }
        if (srcNodeKey && dstNodeKey) break;
      }
      if (!srcNodeKey || !dstNodeKey) {
        console.warn("[transferStateValuesToCollab] Kein gültiges single/collaboration-Paar gefunden.");
        return;
      }

      const srcNode = allNodes[Number(srcNodeKey)];


      /* ----------------------------------------------------------
       * 3) Welche State-Keys sollen kopiert werden?
       * -------------------------------------------------------- */
      const transferKeys = srcNode.collaboration?.transferToCollab ?? [];
      if (transferKeys.length === 0) return;

      const myRoleId = this.myCollabRoleId;

      /* ----------------------------------------------------------
       * 4) Loop über alle Components & NestedComponents
       * -------------------------------------------------------- */
      const srcComponentsBase = `$.nodes.${srcNodeKey}.components` as JSONPathExpression;
      const dstComponentsBase = `$.nodes.${dstNodeKey}.components` as JSONPathExpression;

      const srcComponentIDs = Object.keys(
        this.getProperty(srcComponentsBase) as Record<string, unknown>
      );

      for (const compKey of srcComponentIDs) {
        // nestedComponents des aktuellen Components
        const nestedGroups = this.getProperty(
          `${srcComponentsBase}.${compKey}.nestedComponents`
        ) as NestedComponents;

        for (const groupName of Object.keys(nestedGroups)) {
          // In der Form haben die Gruppen (formComponents, actionComponents, …)
          // typischerweise nur SerializedBaseComponents
          const group =
            nestedGroups[groupName] as Record<string, SerializedBaseComponent>;

          for (const nestedCompKey of Object.keys(group)) {
            const nestedComp = group[nestedCompKey];

            /* ---- 4.1) Filter ------------------------------------------------- */
            const cfg = nestedComp.componentConfiguration;
            if (!cfg || cfg.isCommentable !== true) continue; // nicht kommentierbar

            const stateObj = nestedComp.state as Record<string, unknown>;
            // nur Keys kopieren, die 1) in transferKeys stehen & 2) im State existieren
            const keysToCopy = transferKeys.filter((k) => k in stateObj);
            if (keysToCopy.length === 0) continue;

            /* ---- 4.2) Werte kopieren ----------------------------------------- */
            for (const tKey of keysToCopy) {
              const val = stateObj[tKey];
              if (val === undefined) continue;

              const dstNestedCompKey = `r${myRoleId}_${nestedCompKey}`;
              const dstPath = `${dstComponentsBase}.${compKey}.nestedComponents.${groupName}.${dstNestedCompKey}.state.${tKey}`;

              console.debug(
                `[transferStateValuesToCollab] ${tKey}: ${srcNodeKey}/${nestedCompKey} → ${dstNodeKey}/${dstNestedCompKey}`,
                val
              );

              this.setProperty({
                path: dstPath as JSONPathExpression,
                value: val,
              });
            }
          }
        }
      }
    },

    /**
     * Löscht alle synchronisierbaren State-Felder im SINGLE-Knoten,
     * indem sie auf den leeren String "" gesetzt werden.
     *
     *  • Sucht automatisch den Node mit collaboration.mode === "single".
     *  • Liest dessen collaboration.transferToCollab (z. B. ["fieldValue"]).
     *  • Durchläuft alle Nested-Components und setzt – **ausschließlich bei
     *    isCommentable === true** – jedes dieser Felder auf "".
     *
     * Achtung: Falls ein Feld ursprünglich kein String war (z. B. Zahl oder Objekt),
     * wird es dennoch auf "" gesetzt.  Solltest du dort lieber `null` o. Ä. brauchen,
     * muss die Zuweisung in der `resetValue`-Funktion angepasst werden.
     */
    async clearSinglePhaseValues() {
      console.debug("TaskGraphStore, clearSinglePhaseValues aufgerufen");
      /* ----------------------------------------------------------
       * 1) Dokument fertig?
       * -------------------------------------------------------- */
      while (!this.getProperty("$.documentReady")) {
        await nextTick();
      }

      /* ----------------------------------------------------------
       * 2) SINGLE-Node finden und Transfer-Keys lesen
       * -------------------------------------------------------- */
      const nodes = this.getProperty("$.nodes") as SerialisedNodes;

      const singleNodeEntry = Object.entries(nodes).find(
        ([, node]) => node.collaboration?.mode === "single"
      );
      if (!singleNodeEntry) return;

      const [singleKeyStr, singleNode] = singleNodeEntry;
      const transferKeys = singleNode.collaboration?.transferToCollab ?? [];
      if (transferKeys.length === 0) return;

      /* ----------------------------------------------------------
       * 3) Schleife über alle Components & NestedComponents
       * -------------------------------------------------------- */
      const srcComponentsBase = `$.nodes.${singleKeyStr}.components` as JSONPathExpression;
      const componentIDs = Object.keys(
        this.getProperty(srcComponentsBase) as Record<string, unknown>
      );

      // Hilfsfunktion: auf welchen Wert soll zurückgesetzt werden?
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const resetValue = (_old: unknown): string => "";

      for (const compKey of componentIDs) {
        const nestedGroups = this.getProperty(
          `${srcComponentsBase}.${compKey}.nestedComponents`
        ) as NestedComponents;

        for (const groupName of Object.keys(nestedGroups)) {
          const group = nestedGroups[groupName] as Record<
            string,
            SerializedBaseComponent
          >;

          for (const nestedCompKey of Object.keys(group)) {
            const nestedComp = group[nestedCompKey];

            // nur kommentierbare Komponenten
            if (nestedComp.componentConfiguration?.isCommentable !== true) continue;

            const stateObj = nestedComp.state as Record<string, unknown>;
            const keysToClear = transferKeys.filter((k: string) => k in stateObj);
            if (keysToClear.length === 0) continue;

            // zurücksetzen
            for (const tKey of keysToClear) {
              const srcPath =
                `${srcComponentsBase}.` +
                `${compKey}.nestedComponents.${groupName}.` +
                `${nestedCompKey}.state.${tKey}`;
             console.debug("taskGraphStore, clearSinglePhaseValues schreibt", srcPath, resetValue(stateObj[tKey]));
              this.setProperty({
                path: srcPath as JSONPathExpression,
                value: resetValue(stateObj[tKey]),
              });
            }
          }
        }
      }
    },

    async extractFieldValues() {
      while (!this.getProperty("$.documentReady")) {
        await nextTick()
      }
      const myRoleId  =this.myCollabRoleId;
      console.debug("extractFieldvalues lädt aus collabStore roleId ", myRoleId);
      const srcBase = "$.nodes.0.components.0.nestedComponents.formComponents";
      const dstBase = "$.nodes.2.components.0.nestedComponents.formComponents";

      // alle Feld-IDs der Steckbrief-Aufgabe
      const fields = [
        "latexInputField1",
        "latexInputField2",
        "latexInputField3",
        "inputField1",
        "inputField2",
        "inputField3",
        "inputField4",
      ];
      fields.forEach((fid) => {
        const srcPath = `${srcBase}.${fid}.state.fieldValue` as JSONPathExpression;
        const val = this.getProperty(srcPath);

        if (val === undefined) return;

        const compId = `r${myRoleId}_${fid}`;
        console.debug("taskGraphStore, extractFieldValues schreibt " + `${dstBase}.${compId}.state.fieldValue`, val);
        this.setProperty({
          path: `${dstBase}.${compId}.state.fieldValue`,
          value: val,
        });
      });
    },

    extractValuesByPaths(paths: string[]): Record<string, unknown> {
      const result: Record<string, unknown> = {};

      paths.forEach((path: string) => {
        const value = this.getProperty(path as JSONPathExpression);

        if (value !== undefined) {
          result[path] = value;
        }
      });
      console.debug(" taskGraphStore, extractValuesByPaths schreibt " + result);
      return result;
    },

    extractSessionData(): { collaborationNodes: Record<string, unknown>, taskData: unknown } {
      const result = {
        collaborationNodes: {} as Record<string, unknown>,
        taskData: {}
      };

      const nodes = this.getProperty("$.nodes") as Record<string, unknown> || {};

      Object.entries(nodes).forEach(([nodeId, nodeData]) => {
        const collaborationMode = this.getProperty(`$.nodes.${nodeId}.collaboration.mode`);

        if (collaborationMode === "collaboration") {
          console.debug(`Collaboration-Knoten gefunden: ${nodeId}`);
          result.collaborationNodes[nodeId] = nodeData;
        }
      });

      result.taskData = this.getProperty("$.taskData") || {};

      console.debug("Extrahierte Session-Daten:", {
        collaborationNodes: Object.keys(result.collaborationNodes),
        taskDataKeys: Object.keys(result.taskData as Record<string, unknown>)
      });

      return result;
    },

    async loadSessionForCommentMode(sessionId: number) {
      const commentStore = useCommentStore();

      // Session-Details laden (falls noch nicht geladen)
      await commentStore.fetchSessionDetails(sessionId);

      const sessionDetails = commentStore.currentSessionDetails;
      if (!sessionDetails) {
        console.error(`Keine Session-Details für ID ${sessionId} gefunden`);
        return false;
      }

      // Modus auf Kommentar setzen
      this.isCommentMode = true;

      let { collaborationNodes, taskData } = sessionDetails;

      // Sicherstellen, dass collaborationNodes ein Object ist
      if (typeof collaborationNodes === "string") {
        try {
          collaborationNodes = JSON.parse(collaborationNodes);
        } catch (e) {
          console.error("Fehler beim Parsen der collaborationNodes:", e);
          return false;
        }
      }

      // Gleiches für taskData
      if (typeof taskData === "string") {
        try {
          taskData = JSON.parse(taskData);
        } catch (e) {
          console.error("Fehler beim Parsen der taskData:", e);
          return false;
        }
      }

      // Debug-Ausgabe
      console.log("Geladene collaborationNodes:", collaborationNodes);
      console.log("Anzahl Knoten:", Object.keys(collaborationNodes).length);

      // TaskData setzen
      this.setProperty({
        path: "$.taskData",
        value: taskData
      });

      // Jeden Collaboration-Knoten einzeln setzen
      Object.entries(collaborationNodes).forEach(([nodeId, nodeData]) => {
        console.log(`Setze Node ${nodeId}:`, nodeData);
        this.setProperty({
          path: `$.nodes.${nodeId}`,
          value: nodeData
        });
      });

      // Aktuellen Knoten auf den ersten Collaboration-Knoten setzen
      const firstCollabNodeId = Object.keys(collaborationNodes)[0];
      if (firstCollabNodeId) {
        this.setProperty({
          path: "$.currentNode",
          value: parseInt(firstCollabNodeId)
        });
      }


      this.setAllFieldsReadonly();

      return true;
    },

    setAllFieldsReadonly() {
      const currentNode = this.getCurrentNode;
      if (!currentNode?.components) return;

      Object.entries(currentNode.components).forEach(([componentId, component]) => {
        const basePath = `$.nodes.${this.currentNode}.components.${componentId}`;

        if (component.type === "CollaborativeForm") {
          ["formComponents", "extraRightComponents"].forEach(section => {
            const sectionPath = `${basePath}.nestedComponents.${section}`;
            const components = this.getProperty(sectionPath as JSONPathExpression);

            if (components) {
              Object.keys(components).forEach(fieldId => {
                this.setProperty({
                  path: `${sectionPath}.${fieldId}.componentConfiguration.readonly` as JSONPathExpression,
                  value: true
                });
              });
            }
          });

          // Submit-Button deaktivieren
          const submitPath = `${basePath}.nestedComponents.actionComponents.submit`;
          if (this.getProperty(submitPath as JSONPathExpression)) {
            this.setProperty({
              path: `${submitPath}.componentConfiguration.disabled` as JSONPathExpression,
              value: true
            });
            // Zusätzlich den State auf disabled setzen
            this.setProperty({
              path: `${submitPath}.state.disabled` as JSONPathExpression,
              value: true
            });
          }
        }
      });
    },

    exitCommentMode() {
      this.isCommentMode = false;
      // Optional: Store zurücksetzen oder zur Task-Auswahl navigieren
      this.$reset();
    },

    // In den actions des useTaskGraphStore
    resetValuesByPath(paths: string[]): void {
      if (!Array.isArray(paths)) {
        console.error("resetValuesByPath: paths muss ein Array sein");
        return;
      }

      paths.forEach((path: string) => {
        // Verwende die vorhandene setProperty-Methode, um jeden Wert zurückzusetzen
        this.setProperty({
          path: path as JSONPathExpression,
          value: ""
        });
      });

      console.debug(`${paths.length} Felder wurden zurückgesetzt`);
    },

    setCurrentTask(taskName: string) {
      this.currentTask = taskName;
    },
    setRemoteProperty(payload: StoreSetterPayload) {
      this.applyingRemote = true;
      this.setProperty(payload);
      this.applyingRemote = false;
    },
    setProperty(payload: StoreSetterPayload) {
      // const applicationStore = useApplicationStore();
      const { path, value } = payload;
      const splitPath = JSONPath.toPathArray(path).slice(1);
      let subState = this.$state as StateTree;
      for (let depth = 0; depth < splitPath.length; depth++) {
        if (depth === splitPath.length - 1) {
          // only update the value if it is different
          if (subState[splitPath[depth]] != value) {
            subState[splitPath[depth]] = value;

            // Log the state change in the replayLog
            this.replayLog.interactionEvents.push(payload);

            /**
             * Log the state change in development mode.
             */
            process.env.NODE_ENV === "development" && console.log(path, value);
          }
        } else {
          if (subState[splitPath[depth]] === undefined) {
            subState[splitPath[depth]] = {};
          }
          subState = subState[splitPath[depth]];
        }
      }
      // optional Logging
      process.env.NODE_ENV === "development" && console.log(path, value);
      if (path.endsWith(".fieldValue") || path.includes(".fieldValueByUser.") ) {
        const mode = this.getCurrentCollaborationMode;
        if ((mode === "collaboration"&& !this.applyingRemote) || this.isPromotingToCollab)  {
          console.debug("taskGraphStore, setProperty → syncSingleComponentChange", path, value);
          syncSingleComponentChange(path, value, this.userId);
        }
      }
    },
    /**
     * Required helper functions, as it is not possible to define getters that receive arguments.
     * This is due to getters being simply computed properties.
     * By returning a function from a getter, we can achieve the same functionality, but at the cost of not being able to cache the computed properties.
     * See https://pinia.vuejs.org/core-concepts/getters.html#Passing-arguments-to-getters.
     * @param path JSONPathExpression
     * @returns ComputedRef<any>
     */
    getProperty(path: JSONPathExpression) {
      return this.getPropertyFromPath(path);
    },
    fetchTaskGraph() {
      const applicationStore = useApplicationStore();
      const tasks = applicationStore.tasks;
      const currentTask = tasks[this.currentTask as AvailableTasks];
      if (currentTask) {
        // übernimm "Example.carpet.json" in den State
        for (const [key, value] of Object.entries(currentTask)) {
          this.setProperty({ path: `$.${key}`, value });
        }
        this.setProperty({
          path: "$.currentNode",
          value: currentTask.rootNode,
        });
      }


      const taskDescription = this.getProperty("$.taskData.taskDescription");
      this.setProperty({
        path: "$.nodes.0.components.0.nestedComponents.formComponents.textView1.state.textSegments[0].text",
        value: taskDescription,
      })
      // Ruft nun unsere neue Action auf,
      // um einen DB-Task (basierend auf authStore.currentTaskId) einzubinden:
      //this.loadDBTaskIntoGraph();
    },

    async submitForEvaluation() {
      try {
        const { postEvaluation } = await import(
          "../services/evaluationService"
        );
        console.debug("taskGraphStore ruft evaluationservice auf")
        await postEvaluation();
        return true;
      } catch (error) {
        console.error("Fehler bei der Einreichung der Bewertung:", error);
        return false;
      }
    },

    trackMouse(mouseEvent: { x: number; y: number; timestamp: number }) {
      this.replayLog.mouseEvents.push(mouseEvent);
    },

    toggleLoading() {
      this.isLoading = !this.isLoading;
    },
  },
});
