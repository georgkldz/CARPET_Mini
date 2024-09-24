<template>
  <Controls position="top-left">
    <ControlButton title="Reset Transform" @click="resetTransform">
      <Icon name="reset" />
    </ControlButton>

    <ControlButton
      title="Toggle Dark Mode"
      @click="applicationStore.toggleDarkMode"
    >
      <Icon v-if="applicationStore.darkMode" name="sun" />
      <Icon v-else name="moon" />
    </ControlButton>

    <ControlButton title="Log `toObject`" @click="logToObject">
      <Icon name="log" />
    </ControlButton>
  </Controls>
</template>

<script setup lang="ts">
import { ControlButton, Controls } from "@vue-flow/controls";
import { useVueFlow } from "@vue-flow/core";
import Icon from "./FlowIcon.vue";

import { useApplicationStore } from "src/stores/applicationStore";
const applicationStore = useApplicationStore();

const { setViewport, toObject } = useVueFlow();

/**
 * toObject transforms your current graph data to an easily persist-able object
 */
function logToObject() {
  console.log(toObject());
}

/**
 * Resets the current viewport transformation (zoom & pan)
 */
function resetTransform() {
  setViewport({ x: 0, y: 0, zoom: 1 });
}
</script>
