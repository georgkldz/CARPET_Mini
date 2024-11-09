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

<script lang="ts" setup>
import { NodeResizer, OnResizeStart } from "@vue-flow/node-resizer";
import "@vue-flow/node-resizer/dist/style.css";
import type { NodeProps, NodeDragEvent } from "@vue-flow/core";
import { useTaskGraphStore } from "src/stores/taskGraphStore";
import type { Layout } from "src/stores/applicationStore";
import { useApplicationStore } from "src/stores/applicationStore";
import { useVueFlow } from "@vue-flow/core";
import { unref } from "vue";
import BasicInputField from "src/components/BasicInputField/BasicInputField.vue";
BasicInputField;

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

const lastValidPosition: { x: number | undefined; y: number | undefined } = {
  x: undefined,
  y: undefined,
};
const { onNodeDragStart, onNodeDrag, onNodeDragStop } = useVueFlow();
const nodeDragHandler = (event: NodeDragEvent) => {
  let { x, y } = event.node.position;
  const { height, width } = event.node.dimensions;
  const { id } = event.node;
  const collision = collisionDetection(
    x / xModifier,
    y / yModifier,
    width / xModifier,
    height / yModifier,
    id,
  );
  if (collision.hasOccured) {
    x = event.node.position.x =
      <number>collision.lastValidPosition.x * xModifier;
    y = event.node.position.y =
      <number>collision.lastValidPosition.y * yModifier;
    return;
  }
  taskGraphStore.setProperty({
    path: `$.nodes.${currentNodeId}.layouts.${taskGraphStore.layoutSize}.${id}.x`,
    value: x / xModifier,
  });
  taskGraphStore.setProperty({
    path: `$.nodes.${currentNodeId}.layouts.${taskGraphStore.layoutSize}.${id}.y`,
    value: y / yModifier,
  });
};
onNodeDragStart(nodeDragHandler);
onNodeDrag(nodeDragHandler);
onNodeDragStop(nodeDragHandler);

const collisionDetection = (
  targetX: number,
  targetY: number,
  draggedComponentWidth: number,
  draggedComponentHeight: number,
  currentId: string,
) => {
  const layout: Layout = taskGraphStore.getProperty(
    `$.nodes.${currentNodeId}.layouts.${taskGraphStore.layoutSize}`,
  );
  for (const [id, component] of Object.entries(layout)) {
    // skip position of currently dragged component
    if (id === currentId) continue;
    const { x, y, width, height } = component;
    const padding = 1;
    const lowerBoundX = x - padding;
    const upperBoundX = x + width + padding;
    const lowerBoundY = y - padding;
    const upperBoundY = y + height + padding;
    if (
      targetX + draggedComponentWidth > lowerBoundX &&
      targetX < upperBoundX &&
      targetY + draggedComponentHeight > lowerBoundY &&
      targetY < upperBoundY
    ) {
      // set the last valid position of the dragged component
      return { hasOccured: true, lastValidPosition };
    }
    lastValidPosition["x"] = targetX;
    lastValidPosition["y"] = targetY;
  }
  return { hasOccured: false, lastValidPosition: { x: targetX, y: targetY } };
};

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
</script>

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
