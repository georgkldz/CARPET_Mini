import { defineStore } from "pinia";
import { ref } from "vue";
import type { Ref } from "vue";
import serialisedTaskSchema from "../schemas/zodSchemas/SerialisedTaskSchema";

import type {
  SerializedDOTGraphComponent,
  SerializedFormComponent,
  SerializedButtonComponent,
  SerializedInputFieldComponent,
} from "carpet-component-library";
// import type { SerializedCustomComponents } from "../components/index";
import type { SerializedBasicInputFieldComponent } from "../components/BasicInputField/BasicInputField";

import ExampleTask from "../SerialisedTasks/Example.carpet.json";
const staticTasks = { Example: serialisedTaskSchema.parse(ExampleTask) };

/**
 * The available tasks in the current application.
 */
export type AvailableTasks = keyof typeof staticTasks;

export interface SerialisedComponents {
  [id: number]:
    | SerializedDOTGraphComponent
    | SerializedBasicInputFieldComponent
    | SerializedFormComponent
    | SerializedButtonComponent
    | SerializedInputFieldComponent;
}

export type LayoutSizes = "phone" | "tablet" | "desktop";
export type Layout = {
  [id: number]: {
    x: number;
    y: number;
    height: number;
    width: number;
    padding?: number;
  };
};

export type Layouts = {
  [layoutSize in LayoutSizes]: Layout;
};

export interface TaskData {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface Hints {
  active: boolean;
  current: number;
  descriptions: Array<string>;
}

export interface Modal {
  trigger: {
    type: "success";
  };
  content: {
    header: string;
    body: string;
    footer: {
      buttons: Array<{
        type: "close" | "route";
        label: string;
        parameters?: {
          route: string;
        };
      }>;
    };
  };
}
export type Modals = Array<Modal>;

export interface SerialisedNode {
  layouts: Layouts;
  components: SerialisedComponents;
  hints?: Hints;
  modal?: Modals;
  isValid?: boolean;
  isCorrect?: boolean;
}
export interface SerialisedNodes {
  [id: number]: SerialisedNode;
}

export interface SerialisedTask {
  nodes: SerialisedNodes;
  edges: {
    [nodeId: number]: Array<number>;
  };
  feedbackLevel?:
    | "none"
    | "validity"
    | "correctness"
    | "unpromptedHints"
    | "unpromptedFeedback";
  layoutSize?: LayoutSizes;
  rootNode?: number;
  taskData?: TaskData;
}

export const useApplicationStore = defineStore("applicationStore", () => {
  /**
   * (Mocked) Getter for reading all serialised tasks from the file system.
   * @returns A dictionary of tasks, where the key is the task name and the value is the serialised task.
   */
  const tasks = ref(staticTasks);

  const SNAP_GRID: Ref<[x: number, y: number]> = ref([30, 30]);

  const leftDrawerOpen = ref(false);
  const toggleLeftDrawer = () => {
    leftDrawerOpen.value = !leftDrawerOpen.value;
  };

  const darkMode = ref(false);
  const toggleDarkMode = () => {
    darkMode.value = !darkMode.value;
  };

  return {
    leftDrawerOpen,
    toggleLeftDrawer,
    darkMode,
    toggleDarkMode,
    tasks,
    SNAP_GRID,
  };
});
