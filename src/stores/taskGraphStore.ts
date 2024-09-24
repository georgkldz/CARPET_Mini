import { defineStore } from "pinia";
import type { StateTree } from "pinia";
// import { computed } from "vue";
import { useApplicationStore } from "./applicationStore";
import type { AvailableTasks } from "./applicationStore";
import type { SerialisedTask } from "./applicationStore";
import { JSONPath } from "jsonpath-plus";

import type {
  StoreAPI,
  JSONPathExpression,
  StoreSetterPayload,
} from "carpet-component-library";

// TODO: specifiy the types of the event objects
export interface EventLog {
  interactionEvents: Array<object>;
  mouseEvents: Array<object>;
  panningEvents: Array<object>;
  zoomingEvents: Array<object>;
  metaData: object;
}

export interface CARPETStoreAPI extends StoreAPI {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface TaskGraphState extends SerialisedTask {
  currentTask: string | null;
  isLoading: boolean;
  currentNode: number | null;
  previousNode: number | null;
  replayLog: EventLog;
}

export type TaskGraphStateKey = keyof TaskGraphState;

/**
 * The taskGraphStore has to be defined with the Options-API, as `this.$state` is not available for actions in the Setup-API.
 * Acces to `this.$state` is required to manipulate the store state via `setProperty` from any component.
 */
export const useTaskGraphStore = defineStore("taskGraphStore", {
  state: (): TaskGraphState => ({
    currentTask: null,
    isLoading: false,
    currentNode: null,
    previousNode: null,
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
      else return result;
    },
    getCurrentNode: (state) => {
      return state.nodes[state.currentNode as number];
    },
  },
  actions: {
    setCurrentTask(taskName: string) {
      this.currentTask = taskName;
    },
    setProperty(payload: StoreSetterPayload) {
      const { path, value } = payload;
      const splitPath = JSONPath.toPathArray(path).slice(1);
      const subState = this.$state as StateTree;
      for (let depth = 0; depth < splitPath.length; depth++) {
        if (depth === splitPath.length - 1) {
          if (subState[splitPath[depth]] != value) {
            subState[splitPath[depth]] = value;
          }
        } else subState.value = subState[splitPath[depth]];
      }

      /**
       * Log the state change in development mode.
       */
      process.env.NODE_ENV === "development" && console.log(path, value);
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
      /**
       * Set properites of currentTask via setProperty to include them in the EventLog.
       */
      for (const [key, value] of Object.entries(currentTask)) {
        this.setProperty({ path: `$.${key}`, value: value });
      }
      this.setProperty({ path: "$.currentNode", value: currentTask.rootNode });
    },

    trackMouse(mouseEvent: { x: number; y: number; timestamp: number }) {
      this.replayLog.mouseEvents.push(mouseEvent);
    },

    toggleLoading() {
      this.isLoading = !this.isLoading;
    },
  },
});
