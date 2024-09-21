import { defineStore } from "pinia";
import { computed, ref } from "vue";
import serialisedTaskSchema from "../schemas/zodSchemas/SerialisedTaskSchema";

// TODO: Import all the types from the carpet-component-library in a bundle (maybe expose in the carpet-component-library?)
import type { SerializedDOTGraphComponent } from "carpet-component-library";

import ExampleTask from "../SerialisedTasks/Example.carpet.json";

export type Components = SerializedDOTGraphComponent | undefined;

export interface TaskData {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface SerialisedTask {
  feedbackLevel:
    | "none"
    | "validity"
    | "correctness"
    | "unpromptedHints"
    | "unpromptedFeedback";
  layoutSize: "phone" | "tablet" | "desktop";
  rootNode: number;
  nodes: Record<number, Components>;
  edges: {
    [nodeId: number]: Array<number>;
  };
  taskData?: TaskData;
}

export const useApplicationStore = defineStore("applicationStore", () => {
  /**
   * (Mocked) Getter for reading all serialised tasks from the file system.
   * @returns A dictionary of tasks, where the key is the task name and the value is the serialised task.
   */
  const tasks = computed(() => {
    const tasks: { [taskName: string]: SerialisedTask } = {
      Example: serialisedTaskSchema.parse(ExampleTask),
    };

    return tasks;
  });

  const leftDrawerOpen = ref(false);
  const toggleLeftDrawer = () => {
    leftDrawerOpen.value = !leftDrawerOpen.value;
  };

  return {
    tasks,
    leftDrawerOpen,
    toggleLeftDrawer,
  };
});
