<template>
  <div>
    <p>{{ taskGraphStore.currentTask }}</p>
    {{ task }}
  </div>
</template>

<script setup lang="ts">
import { useRoute } from "vue-router";
import { watch, onMounted } from "vue";
import { useTaskGraphStore } from "src/stores/taskGraphStore";

const taskGraphStore = useTaskGraphStore();
const route = useRoute();
let task = {};

/**
 * Both onMounted and watch are required to either initialize or update the current taskName and load the task when the route changes.
 * This is due to the router not rerendering the component on the same route.
 * See: https://router.vuejs.org/guide/essentials/dynamic-matching.html#Reacting-to-Params-Changes
 */
onMounted(() => {
  taskGraphStore.setCurrentTask(route.params.taskName as string);
  task = taskGraphStore.task;
});
watch(
  () => route.params.taskName,
  (newTaskName) => {
    taskGraphStore.setCurrentTask(newTaskName as string);
    task = taskGraphStore.task;
  },
);
</script>
