import { defineStore } from "pinia";
import type { StateTree } from "pinia";
import { computed, ref, toRefs } from "vue";
import type { Ref, ComputedRef } from "vue";
import { useApplicationStore } from "./applicationStore";
import type { SerialisedTask, TaskData } from "./applicationStore";
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

export const useTaskGraphStore = defineStore(
  "taskGraphStore",
  (): CARPETStoreAPI => {
    const applicationStore = useApplicationStore();

    const currentTask: Ref<string | null> = ref(null);
    const setCurrentTask = (taskName: string) => {
      currentTask.value = taskName;
    };

    const task: ComputedRef<SerialisedTask> = computed(() => {
      return applicationStore.tasks[currentTask.value ?? ""] ?? null;
    });

    const isLoading = ref(false);
    const toggleLoading = () => {
      isLoading.value = !isLoading.value;
    };

    const currentNode: Ref<number | null> = ref(null);
    const previousNode: Ref<number | null> = ref(null);

    const taskData: Ref<TaskData> = ref({});
    const replayLog: Ref<EventLog> = ref({
      interactionEvents: [],
      mouseEvents: [],
      panningEvents: [],
      zoomingEvents: [],
      metaData: {},
    });

    /**
     * The getProperty function is used to get a value from the task.
     * @param path JSONPath expression
     * @returns Any
     */
    const getProperty = (path: JSONPathExpression) => {
      if (typeof path !== "string") {
        throw new Error(`Path is not a string: ${path}`);
      }
      const result = JSONPath({ path: path, json: task });
      if (result.length === 1) return result[0];
      else return result;
    };

    /**
     * The setProperty function is used to mutate a value in the task.
     * @param payload StoreSetterPayload
     */
    const setProperty = (payload: StoreSetterPayload) => {
      const { path, value } = payload;
      const splitPath = JSONPath.toPathArray(path).slice(1);
      const subState = task.value as StateTree;
      for (let depth = 0; depth < splitPath.length; depth++) {
        if (depth === splitPath.length - 1) {
          if (subState[splitPath[depth]] != value) {
            subState[splitPath[depth]] = value;
          }
        } else subState.value = subState[splitPath[depth]];
      }
    };

    return {
      ...toRefs(task),
      toggleLoading,
      currentTask,
      setCurrentTask,
      isLoading,
      currentNode,
      previousNode,
      taskData,
      replayLog,
      getProperty,
      setProperty,
    };
  },
);
