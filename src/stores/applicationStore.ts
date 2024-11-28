import { defineStore } from "pinia";
import { ref } from "vue";
import type { Ref } from "vue";
import axios, { AxiosError } from "axios";
import serialisedTaskSchema from "../schemas/zodSchemas/SerialisedTaskSchema";

import type { SerializedDOTGraphComponent } from "carpet-component-library";
//import type { SerializedCustomComponents } from "../components/index";
import type { SerializedBasicInputFieldComponent } from "../components/BasicInputField/BasicInputField";
import { SerializedLatexInputComponent } from "components/LatexInput/LatexInput.ts";

import ExampleTask from "../SerialisedTasks/Example.carpet.json";
import { SerializedLatexInputFieldComponent } from "components/LatexInputField/LatexInputField.ts";
const staticTasks = { Example: serialisedTaskSchema.parse(ExampleTask) };

/**
 * The available tasks in the current application.
 */
export type AvailableTasks = keyof typeof staticTasks;

export interface SerialisedComponents {
  [id: number]:
    | SerializedDOTGraphComponent
    | SerializedBasicInputFieldComponent
    | SerializedLatexInputComponent
    | SerializedLatexInputFieldComponent;
}

export type LayoutSizes = "phone" | "tablet" | "desktop";
export type Layout = {
  [id: number]: {
    x: number;
    y: number;
    height: number;
    width: number;
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
  const userId = ref<string | null>(null);
  const isAuthenticated = ref(false);

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
  const login = async (payload: { email: string; password: string }) => {
    try {
      const response = await axios.post("http://localhost:3000/login", payload);
      userId.value = response.data.userId; // `.value` bei `ref` erforderlich
      isAuthenticated.value = true;
      console.log("Login erfolgreich! BenutzerID ist " + userId.value);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Verwende AxiosError-Typisierung anstelle von `any`
        const axiosError = error as AxiosError<{ message: string }>;
        const errorMessage =
          axiosError.response?.data?.message || "Login fehlgeschlagen.";
        throw new Error(errorMessage);
      }
      // Allgemeiner Fehler
      throw new Error("Ein unbekannter Fehler ist aufgetreten.");
    }
  };

  const logout = async () => {
    try {
      await axios.post("http://localhost:3000/logout");
      userId.value = null;
      isAuthenticated.value = false;
      console.log("Logout erfolgreich!");
    } catch (error) {
      console.error(
        "Fehler beim Logout:",
        error instanceof Error ? error.message : error,
      );
      throw new Error("Logout fehlgeschlagen.");
    }
  };

  return {
    leftDrawerOpen,
    toggleLeftDrawer,
    darkMode,
    toggleDarkMode,
    tasks,
    SNAP_GRID,
    userId,
    isAuthenticated,
    login,
    logout,
  };
});
