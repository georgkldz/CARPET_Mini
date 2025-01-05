<template>
  <div class="textview-fullwidth">
    <span
      v-for="(seg, idx) in textSegments"
      :key="idx"
      :class="computeClass(seg)"
    >
      {{ seg.text }}
    </span>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, computed, watch, toRefs, unref } from "vue";
import { TextSegment, TextViewComponent } from "components/TextView/TextView.ts";
import type { TextViewProps } from "components/TextView/TextView";

const props = defineProps<TextViewProps>();
const { storeObject, componentID, componentPath } = toRefs(props);

const component = new TextViewComponent(storeObject, unref(componentID), unref(componentPath));
const componentData = component.getComponentData();
//const fieldConfiguration = unref(componentData).fieldConfiguration;

const textSegments = computed(() => unref(componentData).textSegments || []);

function computeClass(seg: TextSegment) {
  return {
    "bold-text": seg.bold,
    "italic-text": seg.italic,
    [seg.cssClass ?? ""]: Boolean(seg.cssClass),
  }
}

onMounted(() => {
  const combined = textSegments.value.map(seg => seg.text).join(" ");
  component.validate(combined);
});

watch(
  () => textSegments.value,
  (newSegs) => {
    // Hier bauen wir den Text zusammen:
    const combined = newSegs.map(seg => seg.text).join(" ");
    component.validate(combined);
  },
  { deep: true }
);

</script>

<style scoped>
.textview-fullwidth {
  width: 500px;
  text-align: left;
}
.bold-text {
  font-weight: bold;
}
.italic-text {
  font-style: italic;
}
</style>
