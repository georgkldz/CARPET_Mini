import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { Ref, ComputedRef } from "vue";
import { useApplicationStore } from "./applicationStore";
import type { SerialisedTask, TaskData } from "./applicationStore";

// TODO: specifiy the types of the event objects
export interface EventLog {
  interactionEvents: Array<object>;
  mouseEvents: Array<object>;
  panningEvents: Array<object>;
  zoomingEvents: Array<object>;
  metaData: object;
}

export const useTaskGraphStore = defineStore("taskGraphStore", () => {
  const applicationStore = useApplicationStore();

  const currentTask: Ref<string | null> = ref(null);
  const setCurrentTask = (taskName: string) => {
    currentTask.value = taskName;
  };

  const task: ComputedRef<SerialisedTask> = computed(() => {
    return applicationStore.tasks[currentTask.value ?? ""] ?? null;
  });

  const isLoading = ref(false);

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

  return {
    task,
    currentTask,
    setCurrentTask,
    isLoading,
    currentNode,
    previousNode,
    taskData,
    replayLog,
  };
});
