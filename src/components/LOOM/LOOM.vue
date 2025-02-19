<template>
  <div class="loom">
    <VueFlow
      :nodes="componentContainers"
      :edges="[]"
      :class="applicationStore.darkMode ? 'dark' : ''"
      class="basic-flow"
      :default-viewport="{ zoom: 1.0 }"
      :min-zoom="0.1"
      :max-zoom="10"
      :snap-to-grid="true"
      :snap-grid="applicationStore.SNAP_GRID"
      :fit-view-on-init="true"
    >
      <NavigationComponent :storeObject="taskGraphStore"> </NavigationComponent>
      <Background pattern-color="#aaa" :gap="30" />
      <ControlBar />
      <MiniMap />

      <template #node-ThreadContainer="props">
        <ThreadContainer v-bind="props" />
      </template>
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { VueFlow } from "@vue-flow/core";

import { Background } from "@vue-flow/background";
import { MiniMap } from "@vue-flow/minimap";
import ControlBar from "./ControlBar.vue";
import { computed } from "vue";

import ThreadContainer from "./ThreadContainer.vue";
import NavigationComponent from "./NavigationComponent.vue";

import type { LayoutSizes } from "src/stores/applicationStore";
import { useApplicationStore } from "src/stores/applicationStore";
import { useTaskGraphStore } from "src/stores/taskGraphStore";

const applicationStore = useApplicationStore();

const taskGraphStore = useTaskGraphStore();

const layoutSize = taskGraphStore.layoutSize;

interface ComponentContainer {
  id: string;
  position: { x: number; y: number };
  data: object;
  type: string;
}

const currentNode = computed(() => taskGraphStore.getCurrentNode);

const componentContainers = computed(() => {
  const layouts = currentNode.value.layouts;
  const layout = layouts[layoutSize as LayoutSizes];

  return Object.entries(layout).reduce((containers, [id, component]) => {
    const { x, y, height, width } = component;

    const [xModifier, yModifier] = applicationStore.SNAP_GRID;

    return [
      ...containers,
      {
        id: id.toString(),
        position: { x: x * xModifier, y: y * yModifier },
        data: {
          height: height * yModifier,
          width: width * xModifier,
          componentId: id,
        },
        type: "ThreadContainer",
      },
    ];
  }, [] as Array<ComponentContainer>);
});

// TODO: Implement tracking of Pane handling (see https://vueflow.dev/guide/utils/instance.html)
</script>

<style scoped>
@import "https://cdn.jsdelivr.net/npm/@vue-flow/core@1.41.2/dist/style.css";
@import "https://cdn.jsdelivr.net/npm/@vue-flow/core@1.41.2/dist/theme-default.css";
@import "https://cdn.jsdelivr.net/npm/@vue-flow/controls@latest/dist/style.css";
@import "https://cdn.jsdelivr.net/npm/@vue-flow/minimap@latest/dist/style.css";
@import "https://cdn.jsdelivr.net/npm/@vue-flow/node-resizer@latest/dist/style.css";

.loom {
  height: 100%;
  width: 100%;
}

.vue-flow__minimap {
  transform: scale(75%);
  transform-origin: bottom right;
}

.basic-flow.dark {
  background: #2d3748;
  color: #fffffb;
}

.basic-flow.dark .vue-flow__node {
  background: #4a5568;
  color: #fffffb;
}

.basic-flow.dark .vue-flow__node.selected {
  background: #333;
  box-shadow: 0 0 0 2px #2563eb;
}

.basic-flow .vue-flow__controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
}

.basic-flow.dark .vue-flow__controls {
  border: 1px solid #fffffb;
}

.basic-flow .vue-flow__controls .vue-flow__controls-button {
  border: none;
  border-right: 1px solid #eee;
}

.basic-flow .vue-flow__controls .vue-flow__controls-button svg {
  height: 100%;
  width: 100%;
}

.basic-flow.dark .vue-flow__controls .vue-flow__controls-button {
  background: #333;
  fill: #fffffb;
  border: none;
}

.basic-flow.dark .vue-flow__controls .vue-flow__controls-button:hover {
  background: #4d4d4d;
}

.basic-flow.dark .vue-flow__edge-textbg {
  fill: #292524;
}

.basic-flow.dark .vue-flow__edge-text {
  fill: #fffffb;
}

.vue-flow__minimap {
  border: 1px solid #333;
  border-radius: 4px;
}
</style>
