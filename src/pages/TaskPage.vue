<template>
  <div class="task">
    <transition name="fade">
      <LoadingSpinner v-if="isLoading" />
    </transition>
    <LOOM v-if="!isLoading" :key="currentNode" :storeObject="taskStore" />
  </div>
</template>

<script lang="ts" setup>
import {
  computed,
  onMounted,
  watch,
  onBeforeUnmount,
  onBeforeMount,
} from "vue";
import { useRoute } from "vue-router";
import LOOM from "src/components/LOOM/LOOM.vue";
import LoadingSpinner from "src/components/LoadingSpinner.vue";
import { useTaskGraphStore } from "src/stores/taskGraphStore";
import {useApplicationStore} from "stores/applicationStore.ts";

const taskStore = useTaskGraphStore();
const applicationStore = useApplicationStore();
const { getProperty } = taskStore;

const route = useRoute();
const currentNode = getProperty("$.currentNode");

const isLoading = computed(() => taskStore.isLoading);
await taskStore.joinSession();
/**
 * Both onMounted and watch are required to either initialize or update the current taskName and load the task when the route changes.
 * This is due to the router not rerendering the component on the same route.
 * See: https://router.vuejs.org/guide/essentials/dynamic-matching.html#Reacting-to-Params-Changes
 */
onBeforeMount(async () => {
   taskStore.setCurrentTask(route.params.taskName as string);
  taskStore.fetchTaskGraph();
});

watch(
  () => route.params.taskName,
  (newTaskName) => {
    taskStore.setCurrentTask(newTaskName as string);
    taskStore.fetchTaskGraph();
  },
);

const throttle = 50;
let last = new Date().getTime();
const trackMouse = (event: MouseEvent) => {
  event.preventDefault();
  const now = new Date().getTime();

  // update only every n milliseconds to not freeze the app
  if (now - last < throttle) return;

  taskStore.trackMouse({
    x: event.pageX,
    y: event.pageY,
    timestamp: now,
  });

  last = now;
};
onMounted(() => {
  document.addEventListener("mousemove", trackMouse);
  applicationStore.joinSession();
});

onBeforeUnmount(() => {
  document.removeEventListener("mousemove", trackMouse);
});
</script>

<style scoped>
.task {
  height: calc(100vh - 50px);
  width: 100%;
}

.slidedown-enter-active,
.slidedown-leave-active {
  transition: max-height 0.3s ease-in-out;
}

.slidedown-enter-to,
.slidedown-leave-from {
  overflow: hidden;
  max-height: 100vh;
}

.slidedown-enter-from,
.slidedown-leave-to {
  overflow: hidden;
  max-height: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
