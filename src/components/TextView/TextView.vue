<template>
  <div>
    {{ value }}
  </div>
</template>

<script lang="ts" setup>
import { onMounted, watch, toRefs, unref, ref } from "vue";
import type { Ref } from "vue";
import { TextViewComponent } from "components/TextView/TextView.ts";
import type { TextViewProps } from "components/TextView/TextView";



const props = defineProps<TextViewProps>();
const { storeObject, componentID, componentPath } = toRefs(props);

const component = new TextViewComponent(storeObject, unref(componentID), unref(componentPath));
const componentData = component.getComponentData();
//const fieldConfiguration = unref(componentData).fieldConfiguration;

const dependencies = component.loadDependencies();

const value: Ref<(typeof componentData.value)["fieldValue"]> = ref(undefined);

onMounted(() => {
  value.value = dependencies.value.referenceValue ?? unref(componentData).fieldValue;
  component.validate(<string | undefined | null>value.value);
});

watch(
  () => dependencies.value.referenceValue,
  (newValue, oldValue) => {
    if (newValue !== oldValue) {
      value.value = newValue;
      component.validate(<string |  undefined | null>value.value);
    }
  }
);

</script>

<style></style>
