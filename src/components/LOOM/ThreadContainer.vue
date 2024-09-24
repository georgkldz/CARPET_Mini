<script lang="ts" setup>
import type { NodeProps } from "@vue-flow/core";
import { useTaskGraphStore } from "src/stores/taskGraphStore";

interface Data {
  componentId: number;
  width: number;
  height: number;
}

interface ThreadContainerProps
  extends Pick<NodeProps<Data, object, "selectorNode">, "data"> {
  data: Data;
}

const props = defineProps<ThreadContainerProps>();

const taskGraphStore = useTaskGraphStore();
const currentNodeId = taskGraphStore.currentNode;
const currentNode = taskGraphStore.getCurrentNode;
const serialisedComponent = currentNode.components[props.data.componentId];

// TODO: Implement configurable Handles/Ports (for connecting Containers via edges)
// import type { CSSProperties } from "vue";
// import { Handle, Position } from "@vue-flow/core";
// const targetHandleStyle: CSSProperties = { background: "#555" };
// const sourceHandleStyleA: CSSProperties = { ...targetHandleStyle, top: "10px" };
// const sourceHandleStyleB: CSSProperties = {
//   ...targetHandleStyle,
//   bottom: "10px",
//   top: "auto",
// };

// TODO: Implement collision detection and container overlap prevention
</script>

<template>
  <div
    class="threadContainer nowheel"
    :id="`componentContainer-${props.data.componentId}`"
    :style="{
      width: `${props.data.width}px`,
      height: `${props.data.height}px`,
      maxHeight: `${props.data.height}px`,
    }"
  >
    <div class="threadContainer__header">
      {{ serialisedComponent.name }}
    </div>
    <div class="threadContainer__body nodrag">
      <component
        class="nodrag"
        :is="serialisedComponent.type"
        :componentID="props.data.componentId"
        :storeObject="{
          store: taskGraphStore,
          getProperty: taskGraphStore.getProperty,
          setProperty: taskGraphStore.setProperty,
        }"
        :componentPath="`$.nodes.${currentNodeId}.components.${props.data.componentId}`"
      ></component>
    </div>
  </div>
</template>

<style>
.threadContainer {
  display: flex;
  flex-direction: column;
  background-color: #e4e9f5;
  border: 1px solid #ccc;
  border-radius: 5px;
}

.threadContainer__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 30px;
  padding: 5px;
  color: white;
  background-color: #4a5568;
  border-bottom: 1px solid grey;
  border-radius: 5px 5px 0 0;
  cursor: move;
}

.threadContainer__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: calc(100% - 30px);
  cursor: auto;
}
</style>
