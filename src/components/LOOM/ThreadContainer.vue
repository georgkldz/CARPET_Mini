<script lang="ts" setup>
import { NodeResizer, OnResizeStart } from "@vue-flow/node-resizer";
import "@vue-flow/node-resizer/dist/style.css";
import type { NodeProps, NodeDragEvent } from "@vue-flow/core";
import { useTaskGraphStore } from "src/stores/taskGraphStore";
import { useApplicationStore } from "src/stores/applicationStore";
import { useVueFlow } from "@vue-flow/core";
import { unref } from "vue";

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

const minHeight = unref(props.data.height);
const minWidth = unref(props.data.width);

const applicationStore = useApplicationStore();
const [xModifier, yModifier] = applicationStore.SNAP_GRID;

const taskGraphStore = useTaskGraphStore();
const currentNodeId = taskGraphStore.currentNode;
const currentNode = taskGraphStore.getCurrentNode;
const serialisedComponent = currentNode.components[props.data.componentId];

const resizeHandler = (e: OnResizeStart) => {
  const { height, width } = e.params;

  taskGraphStore.setProperty({
    path: `$.nodes.${currentNodeId}.layouts.${taskGraphStore.layoutSize}.${props.data.componentId}.width`,
    value: width / xModifier,
  });
  taskGraphStore.setProperty({
    path: `$.nodes.${currentNodeId}.layouts.${taskGraphStore.layoutSize}.${props.data.componentId}.height`,
    value: height / yModifier,
  });
};

const { onNodeDrag, onNodeDragStop } = useVueFlow();
const nodeDragHandler = (event: NodeDragEvent) => {
  const { x, y } = event.node.position;
  taskGraphStore.setProperty({
    path: `$.nodes.${currentNodeId}.layouts.${taskGraphStore.layoutSize}.${props.data.componentId}.x`,
    value: x / xModifier,
  });
  taskGraphStore.setProperty({
    path: `$.nodes.${currentNodeId}.layouts.${taskGraphStore.layoutSize}.${props.data.componentId}.y`,
    value: y / yModifier,
  });
};
onNodeDrag(nodeDragHandler);
onNodeDragStop(nodeDragHandler);

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

    <NodeResizer
      :min-width="minWidth"
      :min-height="minHeight"
      :lineStyle="{ display: 'none' }"
      @resize="resizeHandler"
      @resizeEnd="resizeHandler"
    />
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

.vue-flow__resize-control.top,
.vue-flow__resize-control.bottom.left {
  display: none;
}

.vue-flow__resize-control.bottom.right {
  position: absolute;
  top: 0;
  left: 0;
  width: 6px;
  height: 6px;
  padding: none;
  margin: none;
  background-position: 100% 100%;
  background-repeat: no-repeat;
  background-origin: content-box;
  box-sizing: border-box;
  border: none;
  background: url("data:image/svg+xml;base64,PHN2ZyBzdHlsZT0iYmFja2dyb3VuZC1jb2xvcjojZmZmZmZmMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgd2lkdGg9IjYiIGhlaWdodD0iNiI+PHBhdGggZD0iTTYgNkgwVjQuMmg0LjJWMEg2djZ6IiBvcGFjaXR5PSIuMzAyIi8+PC9zdmc+");
}
</style>
